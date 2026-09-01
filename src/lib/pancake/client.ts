import "server-only"

import {
  pancakeCustomerResponseSchema,
  pancakeResponseSchema,
  PancakeRequestError,
  type PancakeCustomer,
  type PancakeOrder,
} from "./types"
import { isMasked } from "@/lib/phone"
import type { ClaimItem } from "@/lib/points"

// Pancake POS REST client. SERVER-ONLY — PANCAKE_API_KEY must never reach the browser.
//
// The same endpoint resolves both order identifiers, verified live:
//   .../orders/8661            (system_id, the short POS invoice number)
//   .../orders/2607180W78FJH6  (id, printed on the marketplace label)
// so a single call covers whatever the customer types.

const BASE_URL = process.env.PANCAKE_API_URL ?? "https://pos.pages.fm/api/v1"
const TIMEOUT_MS = 8000

function requireEnv() {
  const apiKey = process.env.PANCAKE_API_KEY
  const shopId = process.env.PANCAKE_SHOP_ID
  if (!apiKey || !shopId) {
    throw new PancakeRequestError(
      "unauthorized",
      "PANCAKE_API_KEY/PANCAKE_SHOP_ID not set",
    )
  }
  return { apiKey, shopId }
}

export async function getOrder(code: string): Promise<PancakeOrder> {
  const { apiKey, shopId } = requireEnv()
  const trimmed = code.trim()
  if (!trimmed) throw new PancakeRequestError("not_found")

  const url = `${BASE_URL}/shops/${shopId}/orders/${encodeURIComponent(trimmed)}?api_key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(url, {
      // Order state changes outside our control; never cache it.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new PancakeRequestError("unavailable")
  }

  if (res.status === 401 || res.status === 403) {
    throw new PancakeRequestError("unauthorized")
  }
  if (res.status === 404) throw new PancakeRequestError("not_found")
  if (!res.ok) throw new PancakeRequestError("unavailable")

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new PancakeRequestError("malformed")
  }

  const parsed = pancakeResponseSchema.safeParse(json)
  if (!parsed.success) throw new PancakeRequestError("malformed")
  // Pancake answers 200 with success:false for unknown orders.
  if (parsed.data.success === false || !parsed.data.data) {
    throw new PancakeRequestError("not_found")
  }

  return parsed.data.data
}

// ---- CRM customer ----
//
// The only writes this app makes to Pancake. Registration links an account to a
// POS customer, so the POS record gets the real (unmasked) name and phone the
// member typed — everything the API hands back for a marketplace customer is
// masked, so staff would otherwise have no number to dial. Verified live against
// shop 1328315613: the update is `PUT .../customers/:customer_id` and the body
// MUST be wrapped in `{ customer: … }` (a bare object answers 400, and so does
// POST on the same path).

export async function getCustomer(
  customerId: string,
): Promise<PancakeCustomer> {
  const { apiKey, shopId } = requireEnv()
  const id = customerId.trim()
  if (!id) throw new PancakeRequestError("not_found")

  const url = `${BASE_URL}/shops/${shopId}/customers/${encodeURIComponent(id)}?api_key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new PancakeRequestError("unavailable")
  }

  if (res.status === 401 || res.status === 403) {
    throw new PancakeRequestError("unauthorized")
  }
  if (res.status === 404) throw new PancakeRequestError("not_found")
  if (!res.ok) throw new PancakeRequestError("unavailable")

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new PancakeRequestError("malformed")
  }

  const parsed = pancakeCustomerResponseSchema.safeParse(json)
  if (!parsed.success) throw new PancakeRequestError("malformed")
  if (parsed.data.success === false || !parsed.data.data) {
    throw new PancakeRequestError("not_found")
  }
  return parsed.data.data
}

/**
 * Fills in what the POS record is MISSING: the member's real name and phone.
 *
 * Deliberately not a blind overwrite. Pancake hands back a mask for both fields
 * ("0****52", "L******h"), so the only thing we can tell is whether it already
 * holds something real — and if it does, the shop knows better than a signup
 * form. When nothing is missing no request is sent at all.
 *
 * `phone_numbers` is a whole-array replace on the wire, so the existing entries
 * are kept and the real number is APPENDED. They are masked and useless on their
 * own, but dropping them would rewrite history for a record we only ever see
 * through a mask.
 */
export async function updateCustomer(
  customerId: string,
  { name, phone }: { name: string; phone: string },
): Promise<"updated" | "skipped"> {
  const { apiKey, shopId } = requireEnv()
  const id = customerId.trim()
  if (!id) throw new PancakeRequestError("not_found")

  const existing = await getCustomer(id)
  const existingPhones = existing.phone_numbers ?? []

  const needsPhone = !existingPhones.some((n) => !isMasked(n))
  const needsName = isMasked(existing.name)
  if (!needsPhone && !needsName) return "skipped"

  const payload: { id: string; name?: string; phone_numbers?: string[] } = { id }
  if (needsName) payload.name = name
  if (needsPhone) payload.phone_numbers = [...existingPhones, phone]

  const url = `${BASE_URL}/shops/${shopId}/customers/${encodeURIComponent(id)}?api_key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: payload }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new PancakeRequestError("unavailable")
  }

  if (res.status === 401 || res.status === 403) {
    throw new PancakeRequestError("unauthorized")
  }
  if (res.status === 404) throw new PancakeRequestError("not_found")
  if (!res.ok) throw new PancakeRequestError("unavailable")

  return "updated"
}

// The order code we persist as the idempotency key. Always the stable Pancake
// `id`, never whatever alias the customer happened to type — otherwise the same
// order could be claimed once by `id` and once by `system_id`.
export function canonicalOrderCode(order: PancakeOrder): string {
  return order.id
}

// The SKU/quantity list handed to the claim_points RPC. Shared by the manual
// claim Server Action and the webhook so the two can never drift apart.
export function toClaimItems(order: PancakeOrder): ClaimItem[] {
  return order.items.map((item) => ({
    sku: item.variation_info?.display_id ?? null,
    quantity: item.quantity,
  }))
}

// The `p_items` payload shape the RPC's jsonb_to_recordset expects.
export function toRpcItems(
  order: PancakeOrder,
): { sku: string | null; qty: number }[] {
  return toClaimItems(order).map((i) => ({ sku: i.sku, qty: i.quantity }))
}

/**
 * The money this order counts for towards a tier.
 *
 * `total_price_after_sub_discount` is what the customer actually paid once the
 * order-level discount is off; `total_price` is the pre-discount figure and is
 * only a fallback for older orders that carry no discounted total. Negative or
 * missing values collapse to 0 — the RPC clamps too, but a tier ladder should
 * never see a negative in the first place.
 */
export function orderSpendTotal(order: PancakeOrder): number {
  const total = order.total_price_after_sub_discount ?? order.total_price ?? 0
  return Number.isFinite(total) && total > 0 ? total : 0
}

// TikTok Shop orders sync their final total into Pancake 4-6 days after the
// order lands, so a webhook-time claim can be wrong until then. Matched
// case-insensitively and by substring — Pancake's exact channel string
// ("TikTok Shop", "Tiktok", …) is not something we control.
export function isTikTokSource(sourceName: string | null | undefined): boolean {
  return Boolean(sourceName?.toLowerCase().includes("tiktok"))
}

// How long to wait after a TikTok order is claimed before re-fetching it to
// check whether Pancake's synced total has changed.
export const TIKTOK_RECONCILE_DELAY_DAYS = 6

/**
 * Every phone number the order carries — usually masked ("0****70"), but not
 * always: `customer.phone_numbers` also holds the real number once the record
 * has one. Deliberately NOT a first-match-wins lookup, which is what made the
 * ownership gate settle for `bill_phone_number` (always masked) while a real
 * number sat two fields away. `matchesOrderPhones` decides what to do with them.
 */
export function orderPhoneCandidates(order: PancakeOrder): string[] {
  return [
    order.bill_phone_number,
    ...(order.customer?.phone_numbers ?? []),
    order.shipping_address?.phone_number,
  ].filter((value): value is string => Boolean(value?.trim()))
}
