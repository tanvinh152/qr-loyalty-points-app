"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getOrder, canonicalOrderCode, orderMaskedPhone } from "@/lib/pancake/client"
import { PancakeRequestError, type PancakeOrder } from "@/lib/pancake/types"
import { calcOrderPoints, pointsForItem, type ClaimItem } from "@/lib/points"
import { matchesMask, normalizePhone } from "@/lib/phone"
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit"
import {
  getActiveSettings,
  getCustomerByPhone,
  getNextReward,
  getSkuPoints,
  getTiers,
  isOrderClaimed,
  resolveTiers,
} from "@/lib/loyalty"
import { getMessages } from "@/lib/i18n/server"
import { makeClaimSchema, makeOrderCodeSchema, makePhoneSchema } from "@/lib/schemas"
import type { ClaimResult } from "@/lib/db-types"

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

function toClaimItems(order: PancakeOrder): ClaimItem[] {
  return order.items.map((item) => ({
    sku: item.variation_info?.display_id ?? null,
    quantity: item.quantity,
  }))
}

// -------------------------------------------------------------------------
// Step 1 — order lookup
// -------------------------------------------------------------------------

export type OrderItemView = {
  name: string
  sku: string | null
  quantity: number
  points: number
}

export type LookupResult =
  | {
      ok: true
      orderCode: string
      displayCode: string
      maskedPhone: string
      items: OrderItemView[]
      previewPoints: number
      total: number
    }
  | { ok: false; error: string; code: ClaimErrorCode }

export async function lookupOrder(input: {
  order_code: string
}): Promise<LookupResult> {
  const t = await getMessages()
  const parsed = makeOrderCodeSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return fail("invalid_input", parsed.error.issues[0]?.message)
  }

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
  if (await isOrderClaimed(orderCode)) return fail("already_claimed")

  const maskedPhone = orderMaskedPhone(order)
  if (!maskedPhone) return fail("order_not_eligible")

  const claimItems = toClaimItems(order)
  const skuMap = await getSkuPoints(
    claimItems.map((i) => i.sku).filter((s): s is string => Boolean(s))
  )

  const items: OrderItemView[] = order.items.map((item, index) => ({
    name: item.variation_info?.name ?? "—",
    sku: claimItems[index]!.sku,
    quantity: item.quantity,
    points: pointsForItem(claimItems[index]!, skuMap, settings),
  }))

  // Preview is at ×1: the real multiplier depends on the customer, who is only
  // known after the phone step. The RPC recomputes authoritatively either way.
  return {
    ok: true,
    orderCode,
    displayCode: String(order.system_id ?? order.id),
    maskedPhone,
    items,
    previewPoints: calcOrderPoints(claimItems, skuMap, 1, settings),
    total: order.total_price_after_sub_discount ?? order.total_price ?? 0,
  }
}

// -------------------------------------------------------------------------
// Step 2 — phone ownership check (gates all personal data)
// -------------------------------------------------------------------------

export type PhoneVerifyResult =
  | {
      ok: true
      phone: string
      previewPoints: number
      currentPoints: number
      lifetimePoints: number
      tierName: string | null
      nextTierName: string | null
      pointsToNextTier: number | null
      tierProgress: number
      nextRewardName: string | null
      pointsToNextReward: number | null
      knownCustomer: boolean
      fullName: string | null
      email: string | null
    }
  | { ok: false; error: string; code: ClaimErrorCode }

export async function verifyPhone(input: {
  order_code: string
  phone: string
}): Promise<PhoneVerifyResult> {
  const t = await getMessages()
  const parsed = makeOrderCodeSchema(t.validation)
    .merge(makePhoneSchema(t.validation))
    .safeParse(input)
  if (!parsed.success) {
    return fail("invalid_input", parsed.error.issues[0]?.message)
  }

  const ip = await getClientIp()
  if (await isRateLimited(ip, parsed.data.order_code)) return fail("rate_limited")

  const settings = await getActiveSettings()
  if (!settings) return fail("not_configured")

  // Re-fetch rather than trusting anything the client kept from step 1.
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
  if (!matchesMask(parsed.data.phone, orderMaskedPhone(order))) {
    await recordAttempt(ip, orderCode, false)
    return fail("phone_mismatch")
  }

  if (await isOrderClaimed(orderCode)) return fail("already_claimed")

  const phone = normalizePhone(parsed.data.phone)
  const [customer, tiers] = await Promise.all([getCustomerByPhone(phone), getTiers()])

  const lifetimePoints = customer?.lifetime_points ?? 0
  const currentPoints = customer?.current_points ?? 0
  const { current, next } = resolveTiers(tiers, lifetimePoints)

  const claimItems = toClaimItems(order)
  const skuMap = await getSkuPoints(
    claimItems.map((i) => i.sku).filter((s): s is string => Boolean(s))
  )
  const previewPoints = calcOrderPoints(
    claimItems,
    skuMap,
    current?.multiplier ?? 1,
    settings
  )

  const nextReward = await getNextReward(currentPoints)
  const span = next ? next.threshold - (current?.threshold ?? 0) : 0
  const tierProgress = next
    ? Math.min(1, Math.max(0, (lifetimePoints - (current?.threshold ?? 0)) / span))
    : 1

  await recordAttempt(ip, orderCode, true)

  return {
    ok: true,
    phone,
    previewPoints,
    currentPoints,
    lifetimePoints,
    tierName: current?.name ?? null,
    nextTierName: next?.name ?? null,
    pointsToNextTier: next ? next.threshold - lifetimePoints : null,
    tierProgress,
    nextRewardName: nextReward?.name ?? null,
    pointsToNextReward: nextReward ? nextReward.points_cost - currentPoints : null,
    knownCustomer: Boolean(customer),
    fullName: customer?.full_name ?? null,
    email: customer?.email ?? null,
  }
}

// -------------------------------------------------------------------------
// Step 3 — authoritative, atomic, single-use claim
// -------------------------------------------------------------------------

export type SubmitResult =
  | { ok: true; result: ClaimResult }
  | { ok: false; error: string; code: ClaimErrorCode }

const PG_ERROR_CODES: Record<string, ClaimErrorCode> = {
  P0001: "invalid_input",
  P0002: "already_claimed",
  P0004: "not_configured",
}

export async function submitClaim(input: unknown): Promise<SubmitResult> {
  const t = await getMessages()
  const parsed = makeClaimSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return fail("invalid_input", parsed.error.issues[0]?.message)
  }

  const ip = await getClientIp()
  if (await isRateLimited(ip, parsed.data.order_code)) return fail("rate_limited")

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
  // The ownership check runs again here: step 2's success is not a token.
  if (!matchesMask(parsed.data.phone, orderMaskedPhone(order))) {
    await recordAttempt(ip, orderCode, false)
    return fail("phone_mismatch")
  }

  // Service-role client: claim_points is not granted to anon precisely because
  // it trusts the item list it is handed.
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("claim_points", {
    p_order_code: orderCode,
    p_phone: normalizePhone(parsed.data.phone),
    p_full_name: parsed.data.full_name,
    p_email: parsed.data.email || null,
    p_pancake_customer_id: order.customer?.customer_id ?? null,
    p_items: toClaimItems(order).map((i) => ({ sku: i.sku, qty: i.quantity })),
  })

  if (error) {
    const code: ClaimErrorCode =
      (error.code && PG_ERROR_CODES[error.code]) || "claim_failed"
    return fail(code)
  }

  await recordAttempt(ip, orderCode, true)
  return { ok: true, result: data as ClaimResult }
}
