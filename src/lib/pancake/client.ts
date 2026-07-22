import "server-only"

import {
  pancakeResponseSchema,
  pancakeVariationsResponseSchema,
  PancakeRequestError,
  type CatalogVariation,
  type PancakeOrder,
} from "./types"
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

const CATALOG_PAGE_SIZE = 100
// Sanity stop so a bad total_pages can never spin the request loop.
const CATALOG_MAX_PAGES = 10
// The SKU list barely moves; unlike an order it is safe (and much faster) to cache.
const CATALOG_TTL_S = 300

// Every sellable variation in the shop, for the admin SKU picker. Hidden and
// locked variations are dropped — they can no longer appear on a new order.
export async function listVariations(): Promise<CatalogVariation[]> {
  const { apiKey, shopId } = requireEnv()
  const out: CatalogVariation[] = []

  for (let page = 1; page <= CATALOG_MAX_PAGES; page++) {
    const url =
      `${BASE_URL}/shops/${shopId}/products/variations` +
      `?api_key=${encodeURIComponent(apiKey)}` +
      `&page_size=${CATALOG_PAGE_SIZE}&page_number=${page}`

    let res: Response
    try {
      res = await fetch(url, {
        next: { revalidate: CATALOG_TTL_S },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new PancakeRequestError("unavailable")
    }

    if (res.status === 401 || res.status === 403) {
      throw new PancakeRequestError("unauthorized")
    }
    if (!res.ok) throw new PancakeRequestError("unavailable")

    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new PancakeRequestError("malformed")
    }

    const parsed = pancakeVariationsResponseSchema.safeParse(json)
    if (!parsed.success) throw new PancakeRequestError("malformed")

    for (const v of parsed.data.data) {
      const sku = v.display_id?.trim()
      if (!sku || v.is_hidden || v.is_locked) continue
      const attrs = (v.fields ?? [])
        .map((f) => [f.name, f.value].filter(Boolean).join(": "))
        .filter(Boolean)
        .join(" · ")
      out.push({
        sku,
        name: v.product?.name?.trim() || sku,
        attrs,
        // The array repeats every image twice; the first entry is enough.
        image: v.images?.[0] ?? null,
        price: v.retail_price ?? null,
        remain: v.remain_quantity ?? null,
      })
    }

    if (page >= (parsed.data.total_pages ?? 1)) break
  }

  return out.sort(
    (a, b) => a.name.localeCompare(b.name) || a.attrs.localeCompare(b.attrs),
  )
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
