"use server"

import { createClient } from "@/lib/supabase/server"
import { calcPoints } from "@/lib/points"
import { claimSchema, orderCodeSchema } from "@/lib/schemas"
import type { ClaimResult } from "@/lib/db-types"

export type ValidateResult =
  | { ok: true; orderCode: string; total: number; previewPoints: number }
  | { ok: false; error: string }

// Step 1: look up order + active settings, compute a preview (non-authoritative).
export async function validateOrder(formData: {
  order_code: string
}): Promise<ValidateResult> {
  const parsed = orderCodeSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const supabase = await createClient()

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("order_code, total, status")
    .eq("order_code", parsed.data.order_code)
    .maybeSingle()

  if (orderErr) return { ok: false, error: "Lookup failed. Try again." }
  if (!order) return { ok: false, error: "Order not found." }
  if (order.status === "claimed")
    return { ok: false, error: "This order has already been claimed." }

  const { data: settings, error: setErr } = await supabase
    .from("point_settings")
    .select("conversion_rate, min_order_value, rounding")
    .eq("is_active", true)
    .maybeSingle()

  if (setErr || !settings)
    return { ok: false, error: "Points are not configured yet." }

  return {
    ok: true,
    orderCode: order.order_code,
    total: order.total,
    previewPoints: calcPoints(order.total, settings),
  }
}

export type SubmitResult =
  | { ok: true; result: ClaimResult }
  | { ok: false; error: string }

const PG_ERROR_MESSAGES: Record<string, string> = {
  P0002: "This order has already been claimed.",
  P0003: "Order not found.",
  P0004: "Points are not configured yet.",
}

// Step 3: authoritative, atomic, single-use claim via RPC.
export async function submitClaim(input: unknown): Promise<SubmitResult> {
  const parsed = claimSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("claim_points", {
    p_order_code: parsed.data.order_code,
    p_full_name: parsed.data.full_name,
    p_email: parsed.data.email || null,
    p_phone: parsed.data.phone,
  })

  if (error) {
    const mapped = error.code ? PG_ERROR_MESSAGES[error.code] : undefined
    return { ok: false, error: mapped ?? "Claim failed. Please try again." }
  }

  return { ok: true, result: data as ClaimResult }
}
