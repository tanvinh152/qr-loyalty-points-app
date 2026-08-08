import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  getOrder,
  canonicalOrderCode,
  orderSpendTotal,
  toRpcItems,
  isTikTokSource,
  TIKTOK_RECONCILE_DELAY_DAYS,
} from "@/lib/pancake/client"
import { PancakeRequestError } from "@/lib/pancake/types"
import {
  getActiveSettings,
  getCustomerByPancakeId,
  isOrderClaimed,
} from "@/lib/loyalty"
import { verifyWebhookSecret } from "@/lib/webhook-auth"
import type { ClaimResult } from "@/lib/db-types"

// Pancake order webhook — the ONLY way points are earned after signup.
//
// Pancake masks phone numbers ("0****70"), so this endpoint can never mint a new
// customer: there is no real phone to key on. It attributes an order only when
// `customer.customer_id` already matches a customers row, i.e. someone who
// registered and passed the masked-phone gate on their proof order. A buyer who
// never registered earns nothing until they do.
//
// Pancake retries on any non-2xx, so every *business* outcome (not eligible,
// already claimed, unknown customer) answers 200. Only auth failures, malformed
// bodies and genuinely retryable faults get an error status.

// Deliberately loose: the real webhook envelope is unverified, and nothing in it
// is trusted beyond the order identifier — the order itself is re-fetched from
// the API below.
const identifierSchema = z.union([z.string().min(1), z.number().int()])
const payloadSchema = z.object({
  id: identifierSchema.nullish(),
  system_id: identifierSchema.nullish(),
  order: z.object({ id: identifierSchema.nullish() }).nullish(),
  data: z
    .object({
      id: identifierSchema.nullish(),
      system_id: identifierSchema.nullish(),
    })
    .nullish(),
})

function extractOrderId(body: unknown): string | null {
  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) return null
  const p = parsed.data
  const candidate =
    p.id ?? p.data?.id ?? p.order?.id ?? p.system_id ?? p.data?.system_id
  return candidate == null ? null : String(candidate)
}

function skip(reason: string, orderCode?: string) {
  console.warn(`[pancake-webhook] skipped: ${reason}`, orderCode ?? "")
  return Response.json({ claimed: false, skipped: reason })
}

export async function POST(req: Request) {
  if (!verifyWebhookSecret(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 422 })
  }

  const orderId = extractOrderId(body)
  if (!orderId) {
    return Response.json({ error: "missing_order_id" }, { status: 422 })
  }

  // Everything below reads the AUTHORITATIVE order from the API. The webhook
  // body is only ever a pointer, so a forged payload buys nothing and a schema
  // change on Pancake's side cannot corrupt a claim.
  let order
  try {
    order = await getOrder(orderId)
  } catch (err) {
    if (err instanceof PancakeRequestError && err.kind === "not_found") {
      return skip("order_not_found", orderId)
    }
    // A bad API key or a payload shape we cannot read will look exactly the
    // same on the next delivery, so 503 would only buy an endless retry storm
    // against a bug nobody is being paged about. Answer 200 and shout in the
    // logs; `unavailable` is the one kind retrying can actually fix.
    if (
      err instanceof PancakeRequestError &&
      (err.kind === "unauthorized" || err.kind === "malformed")
    ) {
      console.error(
        `[pancake-webhook] CONFIG ERROR (${err.kind}) — points are being dropped`,
        orderId,
        err,
      )
      return skip("pancake_misconfigured", orderId)
    }
    console.error("[pancake-webhook] order fetch failed", orderId, err)
    // Retryable on Pancake's side.
    return Response.json({ error: "pancake_unavailable" }, { status: 503 })
  }

  const settings = await getActiveSettings()
  if (!settings) {
    console.error("[pancake-webhook] no active loyalty settings")
    return Response.json({ error: "not_configured" }, { status: 503 })
  }

  // The actual trigger: points only exist once the order reaches a status the
  // shop counts as settled (3 / 16 by default).
  if (!settings.claimable_statuses.includes(order.status)) {
    return skip("not_eligible", orderId)
  }

  const orderCode = canonicalOrderCode(order)
  const pancakeCustomerId = order.customer?.customer_id

  // Both lookups THROW on a database error rather than answering "no". That
  // distinction is the whole point: `unknown_customer` is a 200, and Pancake
  // never retries a 200, so a blip that returned it silently burned the points.
  // A 503 gets the same delivery again once the database is back.
  let customer
  try {
    if (await isOrderClaimed(orderCode)) return skip("already_claimed", orderCode)
    customer = pancakeCustomerId
      ? await getCustomerByPancakeId(pancakeCustomerId)
      : null
  } catch (err) {
    console.error("[pancake-webhook] customer lookup failed", orderCode, err)
    return Response.json({ error: "db_unavailable" }, { status: 503 })
  }

  // Genuinely nobody to credit — a conclusion, not a fault. Nothing to retry.
  if (!pancakeCustomerId || !customer) {
    return skip("unknown_customer", orderCode)
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("claim_points", {
    p_order_code: orderCode,
    p_phone: customer.phone,
    p_full_name: customer.full_name,
    p_email: customer.email,
    p_pancake_customer_id: pancakeCustomerId,
    p_items: toRpcItems(order),
    p_source: "webhook",
    // Points and money are credited from the same call but land in different
    // columns: points buy rewards, this decides the tier.
    p_order_total: orderSpendTotal(order),
  })

  if (error) {
    // Lost the race against a manual claim (or a duplicate delivery) — the
    // unique index on order_code did its job. Not a failure Pancake should retry.
    if (error.code === "P0002") return skip("already_claimed", orderCode)
    console.error("[pancake-webhook] claim_points failed", orderCode, error)
    return Response.json({ error: "claim_failed" }, { status: 500 })
  }

  const result = data as ClaimResult
  console.info(
    `[pancake-webhook] claimed ${orderCode}: +${result.points_awarded} points`,
  )

  if (isTikTokSource(order.order_sources_name)) {
    await enqueueTikTokReconciliation({
      orderCode,
      customerId: customer.id,
      sourceName: order.order_sources_name ?? "",
      claimedTotal: orderSpendTotal(order),
    })
  }

  // No customer PII in the response — Pancake logs webhook bodies.
  return Response.json({
    claimed: true,
    points_awarded: result.points_awarded,
  })
}

/**
 * Queues a claimed TikTok order for a later re-check once Pancake's sync has
 * had time to settle (see 0016_tiktok_reconciliation.sql). Best-effort: the
 * claim already succeeded, so a failure here only means this one order misses
 * reconciliation — it must never turn a successful claim into an error response.
 */
async function enqueueTikTokReconciliation({
  orderCode,
  customerId,
  sourceName,
  claimedTotal,
}: {
  orderCode: string
  customerId: string
  sourceName: string
  claimedTotal: number
}) {
  const reconcileAfter = new Date(
    Date.now() + TIKTOK_RECONCILE_DELAY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { error } = await createAdminClient()
    .from("pending_order_reconciliations")
    .insert({
      order_code: orderCode,
      customer_id: customerId,
      source_name: sourceName,
      claimed_total: claimedTotal,
      reconcile_after: reconcileAfter,
    })

  if (error) {
    console.error(
      "[pancake-webhook] failed to enqueue TikTok reconciliation",
      orderCode,
      error,
    )
  }
}
