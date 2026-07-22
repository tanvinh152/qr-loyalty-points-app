"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getCustomerByAuthUserId } from "@/lib/loyalty"
import { getMessages } from "@/lib/i18n/server"

// Redemption is a balance-moving write, so it goes through the redeem_reward
// RPC (0006_redeem_rpc.sql) exactly the way a claim goes through claim_points:
// the RPC is service_role-only and does the stock/balance checks under a row
// lock. The session is what proves whose balance may be spent — the client only
// ever sends a reward id.

export type RedeemErrorCode =
  | "session_expired"
  | "no_customer"
  | "reward_not_found"
  | "out_of_stock"
  | "insufficient_points"
  | "redeem_failed"

export type RedeemResult =
  | { ok: true; rewardName: string; pointsSpent: number; currentPoints: number }
  | { ok: false; code: RedeemErrorCode; error: string }

async function fail(code: RedeemErrorCode): Promise<RedeemResult> {
  const e = (await getMessages()).customer.errors
  const byCode: Record<RedeemErrorCode, string> = {
    session_expired: e.sessionExpired,
    no_customer: e.noCustomer,
    reward_not_found: e.rewardNotFound,
    out_of_stock: e.outOfStock,
    insufficient_points: e.insufficientPoints,
    redeem_failed: e.redeemFailed,
  }
  return { ok: false, code, error: byCode[code] }
}

// Postgres error codes raised by redeem_reward.
function codeFor(pgCode: string | undefined): RedeemErrorCode {
  if (pgCode === "P0001") return "reward_not_found"
  if (pgCode === "P0002") return "out_of_stock"
  if (pgCode === "P0003") return "insufficient_points"
  return "redeem_failed"
}

export async function redeemReward(rewardId: string): Promise<RedeemResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("session_expired")

  const customer = await getCustomerByAuthUserId(user.id)
  if (!customer) return fail("no_customer")

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("redeem_reward", {
    p_customer_id: customer.id,
    p_reward_id: rewardId,
  })

  if (error) return fail(codeFor(error.code))

  const result = data as {
    reward_name: string
    points_spent: number
    current_points: number
  }

  revalidatePath("/rewards")
  revalidatePath("/dashboard")
  revalidatePath("/history")

  return {
    ok: true,
    rewardName: result.reward_name,
    pointsSpent: result.points_spent,
    currentPoints: result.current_points,
  }
}
