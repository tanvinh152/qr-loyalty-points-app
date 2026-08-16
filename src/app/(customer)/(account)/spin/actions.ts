"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getCustomerByAuthUserId } from "@/lib/loyalty"
import { getMessages } from "@/lib/i18n/server"
import type { SpinResult } from "@/lib/db-types"

// The wheel is drawn INSIDE the spin_wheel RPC (0022), service_role-only like
// claim_points and redeem_reward. The browser sends nothing but the click: the
// session proves whose balance moves, the RPC picks the prize and enforces the
// daily limit, and the animation merely spins to the answer it already gave.
//
// Nothing here re-checks the limit before calling. A pre-flight count would
// only be a second, racier copy of the check the RPC already holds a row lock
// for — P0002 is the authority.

export type SpinErrorCode =
  | "session_expired"
  | "no_customer"
  | "no_spins_left"
  | "unavailable"
  | "spin_failed"

export type SpinActionResult =
  | { ok: true; result: SpinResult }
  | { ok: false; code: SpinErrorCode; error: string }

function codeFor(pgCode: string | undefined): SpinErrorCode {
  if (pgCode === "P0002") return "no_spins_left"
  // P0004 covers both "no active settings" and "nothing left to draw"; P0005 is
  // the admin switching the wheel off. All three read the same to a member.
  if (pgCode === "P0004" || pgCode === "P0005") return "unavailable"
  return "spin_failed"
}

export async function spin(): Promise<SpinActionResult> {
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
  const { data, error } = await admin.rpc("spin_wheel", {
    p_customer_id: customer.id,
  })

  if (error) {
    const code = codeFor(error.code)
    const byCode: Record<SpinErrorCode, string> = {
      session_expired: e.sessionExpired,
      no_customer: e.noCustomer,
      no_spins_left: e.noSpinsLeft,
      unavailable: e.spinUnavailable,
      spin_failed: e.spinFailed,
    }
    return { ok: false, code, error: byCode[code] }
  }

  // Deliberately NOT revalidating /spin: that would re-render the wheel's own
  // props mid-animation, and a gift that just sold out would drop its wedge out
  // from under the spin in progress. The wheel refreshes itself once it stops.
  revalidatePath("/dashboard")
  revalidatePath("/history")

  return { ok: true, result: data as SpinResult }
}
