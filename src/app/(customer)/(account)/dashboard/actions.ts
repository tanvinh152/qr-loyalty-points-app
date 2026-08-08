"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getCustomerByAuthUserId } from "@/lib/loyalty"
import { getMessages } from "@/lib/i18n/server"
import type { CheckinResult } from "@/lib/db-types"

// A new, Pancake-independent earning path (0019): the checkin RPC is the only
// write path, service_role-only like claim_points/redeem_reward. The session
// is what proves whose balance gets the points — the client sends nothing but
// the click.

export type CheckinErrorCode =
  | "session_expired"
  | "no_customer"
  | "already_checked_in"
  | "unavailable"
  | "checkin_failed"

export type CheckinActionResult =
  | { ok: true; pointsAwarded: number; currentPoints: number }
  | { ok: false; code: CheckinErrorCode; error: string }

function codeFor(pgCode: string | undefined): CheckinErrorCode {
  if (pgCode === "P0002") return "already_checked_in"
  if (pgCode === "P0004" || pgCode === "P0005") return "unavailable"
  return "checkin_failed"
}

export async function checkIn(): Promise<CheckinActionResult> {
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
  const { data, error } = await admin.rpc("checkin", {
    p_customer_id: customer.id,
  })

  if (error) {
    const code = codeFor(error.code)
    const byCode: Record<CheckinErrorCode, string> = {
      session_expired: e.sessionExpired,
      no_customer: e.noCustomer,
      already_checked_in: e.alreadyCheckedIn,
      unavailable: e.checkinUnavailable,
      checkin_failed: e.checkinFailed,
    }
    return { ok: false, code, error: byCode[code] }
  }

  const result = data as CheckinResult
  revalidatePath("/dashboard")
  revalidatePath("/history")

  return {
    ok: true,
    pointsAwarded: result.points_awarded,
    currentPoints: result.current_points,
  }
}
