"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getCustomerByAuthUserId } from "@/lib/loyalty"
import { getMessages } from "@/lib/i18n/server"
import type { MilestoneClaimResult } from "@/lib/db-types"

// Claiming goes through the claim_milestone_reward RPC (0024), service_role-only
// like claim_points and redeem_reward. The browser sends nothing but the
// milestone id: the SESSION is what proves whose award this is, so
// `p_customer_id` is resolved here and never taken from the request.
//
// Nothing here re-checks eligibility before calling. A pre-flight comparison
// would only be a second, racier copy of the check the RPC already holds a row
// lock for — P0006 and P0003 are the authority.

export type MilestoneErrorCode =
  | "session_expired"
  | "no_customer"
  | "locked"
  | "already_claimed"
  | "unavailable"
  | "claim_failed"

export type MilestoneActionResult =
  | { ok: true; result: MilestoneClaimResult }
  | { ok: false; code: MilestoneErrorCode; error: string }

function codeFor(pgCode: string | undefined): MilestoneErrorCode {
  if (pgCode === "P0006") return "locked"
  if (pgCode === "P0003") return "already_claimed"
  // P0001 covers both "no such customer" and "no such active milestone" — a
  // deactivated rung and a forged id read the same to a member, on purpose.
  if (pgCode === "P0001") return "unavailable"
  return "claim_failed"
}

export async function claimMilestone(
  milestoneId: string,
): Promise<MilestoneActionResult> {
  const e = (await getMessages()).customer.errors

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, code: "session_expired", error: e.sessionExpired }
  }

  const customer = await getCustomerByAuthUserId(user.id)
  if (!customer) {
    return { ok: false, code: "no_customer", error: e.noCustomer }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("claim_milestone_reward", {
    p_customer_id: customer.id,
    p_milestone_id: milestoneId,
  })

  if (error) {
    const code = codeFor(error.code)
    const byCode: Record<MilestoneErrorCode, string> = {
      session_expired: e.sessionExpired,
      no_customer: e.noCustomer,
      locked: e.milestoneLocked,
      already_claimed: e.milestoneClaimed,
      unavailable: e.milestoneUnavailable,
      claim_failed: e.milestoneClaimFailed,
    }
    return { ok: false, code, error: byCode[code] }
  }

  // The node flips to "claimed" and the dashboard's pending count moves. No
  // ledger row exists to revalidate — the ladder credits no points.
  revalidatePath("/rewards/roadmap")
  revalidatePath("/dashboard")

  return { ok: true, result: data as MilestoneClaimResult }
}
