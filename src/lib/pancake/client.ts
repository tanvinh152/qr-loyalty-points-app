import "server-only"

import {
  pancakeResponseSchema,
  PancakeRequestError,
  type PancakeOrder,
} from "./types"

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
    throw new PancakeRequestError("unauthorized", "PANCAKE_API_KEY/PANCAKE_SHOP_ID not set")
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

// The order code we persist as the idempotency key. Always the stable Pancake
// `id`, never whatever alias the customer happened to type — otherwise the same
// order could be claimed once by `id` and once by `system_id`.
export function canonicalOrderCode(order: PancakeOrder): string {
  return order.id
}

// Masked phone as returned by Pancake, e.g. "0****70". Falls back through the
// places the API puts it.
export function orderMaskedPhone(order: PancakeOrder): string | null {
  return (
    order.bill_phone_number ??
    order.customer?.phone_numbers?.[0] ??
    order.shipping_address?.phone_number ??
    null
  )
}
