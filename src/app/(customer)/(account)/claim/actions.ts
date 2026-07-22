"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  getOrder,
  canonicalOrderCode,
  orderMaskedPhone,
  toClaimItems,
  toRpcItems,
} from "@/lib/pancake/client"
import { PancakeRequestError, type PancakeOrder } from "@/lib/pancake/types"
import { calcOrderPoints, pointsForItem } from "@/lib/points"
import { matchesMask } from "@/lib/phone"
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit"
import {
  getActiveSettings,
  getNextReward,
  getSkuPoints,
  getTiers,
  isOrderClaimed,
  resolveTiers,
  type ActiveSettings,
} from "@/lib/loyalty"
import { getMessages } from "@/lib/i18n/server"
import { makeOrderCodeSchema } from "@/lib/schemas"
import type { ClaimResult, CustomerRow } from "@/lib/db-types"
import { getAccount } from "../account"

// The claim flow is signed-in only: the phone is never typed here, it comes from
// the session's customer row (customers log in with it — see phoneToEmail in
// src/lib/phone.ts). It is still the ownership gate: every call re-checks it
// against the order's masked phone, so a member cannot claim someone else's order.

// Stable codes so client logic never depends on (localized) message text.
export type ClaimErrorCode =
  | "invalid_input"
  | "lookup_failed"
  | "order_not_found"
  | "order_not_eligible"
  | "already_claimed"
  | "not_configured"
  | "phone_mismatch"
  | "rate_limited"
  | "pancake_unavailable"
  | "claim_failed"
  | "no_account"

async function errorMessages() {
  return (await getMessages()).claim.errors
}

async function fail(code: ClaimErrorCode, override?: string) {
  const e = await errorMessages()
  const byCode: Record<ClaimErrorCode, string> = {
    invalid_input: e.invalidInput,
    lookup_failed: e.lookupFailed,
    order_not_found: e.orderNotFound,
    order_not_eligible: e.orderNotEligible,
    already_claimed: e.alreadyClaimed,
    not_configured: e.notConfigured,
    phone_mismatch: e.phoneMismatch,
    rate_limited: e.rateLimited,
    pancake_unavailable: e.pancakeUnavailable,
    claim_failed: e.claimFailed,
    no_account: e.noAccount,
  }
  return { ok: false as const, code, error: override ?? byCode[code] }
}

function pancakeErrorCode(err: unknown): ClaimErrorCode {
  if (err instanceof PancakeRequestError) {
    if (err.kind === "not_found") return "order_not_found"
    return "pancake_unavailable"
  }
  return "lookup_failed"
}

/**
 * Everything both actions share: validate the code, rate limit, load the
 * settings, fetch the order and prove the signed-in member owns it.
 */
type Checked = {
  customer: CustomerRow
  order: PancakeOrder
  orderCode: string
  settings: ActiveSettings
  ip: string
}

async function checkOrder(
  input: unknown,
): Promise<
  | { ok: true; data: Checked }
  | { ok: false; code: ClaimErrorCode; error: string }
> {
  const t = await getMessages()
  const parsed = makeOrderCodeSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return fail("invalid_input", parsed.error.issues[0]?.message)
  }

  const { customer } = await getAccount()
  if (!customer) return fail("no_account")

  const ip = await getClientIp()
  if (await isRateLimited(ip)) return fail("rate_limited")

  const settings = await getActiveSettings()
  if (!settings) return fail("not_configured")

  let order: PancakeOrder
  try {
    order = await getOrder(parsed.data.order_code)
  } catch (err) {
    await recordAttempt(ip, parsed.data.order_code, false)
    return fail(pancakeErrorCode(err))
  }

  if (!settings.claimable_statuses.includes(order.status)) {
    return fail("order_not_eligible")
  }

  const orderCode = canonicalOrderCode(order)
  const maskedPhone = orderMaskedPhone(order)
  if (!maskedPhone) return fail("order_not_eligible")

  // The ownership gate. The session says who the member is; this says the order
  // is theirs.
  if (!matchesMask(customer.phone, maskedPhone)) {
    await recordAttempt(ip, orderCode, false)
    return fail("phone_mismatch")
  }

  if (await isOrderClaimed(orderCode)) return fail("already_claimed")

  return { ok: true, data: { customer, order, orderCode, settings, ip } }
}

// -------------------------------------------------------------------------
// Step 1 — preview (order lookup + what this member would earn)
// -------------------------------------------------------------------------

export type OrderItemView = {
  name: string
  sku: string | null
  quantity: number
  points: number
}

export type PreviewResult =
  | {
      ok: true
      orderCode: string
      displayCode: string
      items: OrderItemView[]
      total: number
      /** Points before the tier multiplier — the summary shows the bonus split. */
      basePoints: number
      previewPoints: number
      currentPoints: number
      tierName: string | null
      nextTierName: string | null
      pointsToNextTier: number | null
      tierProgress: number
      nextRewardName: string | null
      pointsToNextReward: number | null
    }
  | { ok: false; error: string; code: ClaimErrorCode }

export async function previewClaim(input: {
  order_code: string
}): Promise<PreviewResult> {
  const checked = await checkOrder(input)
  if (!checked.ok) return checked
  const { customer, order, orderCode, settings, ip } = checked.data

  const claimItems = toClaimItems(order)
  const skuMap = await getSkuPoints(
    claimItems.map((i) => i.sku).filter((s): s is string => Boolean(s)),
  )

  const items: OrderItemView[] = order.items.map((item, index) => ({
    name: item.variation_info?.name ?? "—",
    sku: claimItems[index]!.sku,
    quantity: item.quantity,
    points: pointsForItem(claimItems[index]!, skuMap, settings),
  }))

  const tiers = await getTiers()
  const { current, next } = resolveTiers(tiers, customer.lifetime_points)

  const basePoints = calcOrderPoints(claimItems, skuMap, 1, settings)
  const previewPoints = calcOrderPoints(
    claimItems,
    skuMap,
    current?.multiplier ?? 1,
    settings,
  )

  const nextReward = await getNextReward(customer.current_points)
  const span = next ? next.threshold - (current?.threshold ?? 0) : 0
  const tierProgress = next
    ? Math.min(
        1,
        Math.max(
          0,
          (customer.lifetime_points - (current?.threshold ?? 0)) / span,
        ),
      )
    : 1

  await recordAttempt(ip, orderCode, true)

  return {
    ok: true,
    orderCode,
    displayCode: String(order.system_id ?? order.id),
    items,
    total: order.total_price_after_sub_discount ?? order.total_price ?? 0,
    basePoints,
    previewPoints,
    currentPoints: customer.current_points,
    tierName: current?.name ?? null,
    nextTierName: next?.name ?? null,
    pointsToNextTier: next ? next.threshold - customer.lifetime_points : null,
    tierProgress,
    nextRewardName: nextReward?.name ?? null,
    pointsToNextReward: nextReward
      ? nextReward.points_cost - customer.current_points
      : null,
  }
}

// -------------------------------------------------------------------------
// Step 2 — authoritative, atomic, single-use claim
// -------------------------------------------------------------------------

export type SubmitResult =
  | { ok: true; result: ClaimResult }
  | { ok: false; error: string; code: ClaimErrorCode }

const PG_ERROR_CODES: Record<string, ClaimErrorCode> = {
  P0001: "invalid_input",
  P0002: "already_claimed",
  P0004: "not_configured",
}

export async function submitClaim(input: {
  order_code: string
}): Promise<SubmitResult> {
  // The preview's success is not a token: everything is re-checked here.
  const checked = await checkOrder(input)
  if (!checked.ok) return checked
  const { customer, order, orderCode, ip } = checked.data

  // Service-role client: claim_points is not granted to anon precisely because
  // it trusts the item list it is handed.
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("claim_points", {
    p_order_code: orderCode,
    p_phone: customer.phone,
    p_full_name: customer.full_name,
    p_email: customer.email,
    p_pancake_customer_id: order.customer?.customer_id ?? null,
    p_items: toRpcItems(order),
    p_source: "claim",
  })

  if (error) {
    const code: ClaimErrorCode =
      (error.code && PG_ERROR_CODES[error.code]) || "claim_failed"
    return fail(code)
  }

  await recordAttempt(ip, orderCode, true)
  return { ok: true, result: data as ClaimResult }
}
