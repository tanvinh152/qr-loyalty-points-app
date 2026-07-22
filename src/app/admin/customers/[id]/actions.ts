"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeAdjustSchema, type AdjustInput } from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

/**
 * Grants tier and/or points to a customer. Everything lands through the
 * adjust_points RPC (0008) so the ledger row and the balance can never diverge —
 * this action must never UPDATE public.customers itself.
 */
export async function adjustPoints(input: AdjustInput): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.customers.detail.adjust

  const parsed = makeAdjustSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? m.saveFailed }
  }

  // The proxy already guards /admin, but this action reaches for the
  // service-role client — so it re-checks the same claim the middleware reads
  // (src/lib/supabase/middleware.ts) rather than trusting the route it sits on.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.app_metadata?.role !== "admin") {
    return { ok: false, message: m.forbidden }
  }

  const { customer_id, current_delta, lifetime_delta, grant_tier_id, reason } =
    parsed.data

  const { error } = await createAdminClient().rpc("adjust_points", {
    p_customer_id: customer_id,
    p_current_delta: current_delta,
    p_lifetime_delta: lifetime_delta,
    p_grant_tier_id: grant_tier_id || null,
    p_reason: reason,
    p_actor: { id: user.id, email: user.email ?? null },
  })

  if (error) {
    if (error.code === "P0003") return { ok: false, message: m.insufficient }
    if (error.code === "P0005") return { ok: false, message: m.noChange }
    console.error("[admin] adjust_points failed", customer_id, error)
    return { ok: false, message: m.saveFailed }
  }

  revalidatePath(`/admin/customers/${customer_id}`)
  revalidatePath("/admin/customers")
  revalidatePath("/admin/transactions")
  // The customer's own screens read the same columns.
  revalidatePath("/dashboard")
  revalidatePath("/tiers")
  revalidatePath("/history")
  return { ok: true, message: m.saved }
}
