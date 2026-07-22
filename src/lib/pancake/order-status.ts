// Pancake order status codes.
//
// Verified against the live shop (ChiCha Cat Litter, 3.968 orders) by reading
// the `status` / `status_name` pairs the API actually returns — not guessed
// from docs. Codes the shop has never produced (9, 11, 12, 13, 15, 17, 20)
// are deliberately absent; `statusKey()` returns null for them and callers
// fall back to a generic "status #N" label.
//
// Labels live in the i18n catalogs (`t.pancakeStatus.*`), never here.

/** Display order = the real order lifecycle, not numeric order. */
export const PANCAKE_ORDER_STATUSES = [0, 1, 8, 2, 3, 16, 4, 5, 6, 7] as const

export type PancakeOrderStatus = (typeof PANCAKE_ORDER_STATUSES)[number]

/**
 * Statuses that mean "the customer has the goods and the money is settled".
 * Suggested (pre-ticked) in admin settings when nothing is configured yet —
 * 3 alone would reject the ~700 orders that have moved on to 16.
 */
export const DEFAULT_CLAIMABLE_STATUSES: number[] = [3, 16]

/** Pancake's own `status_name` for each code, keyed by code. */
const STATUS_NAMES: Record<number, string> = {
  0: "new",
  1: "submitted",
  2: "shipped",
  3: "delivered",
  4: "returning",
  5: "returned",
  6: "canceled",
  7: "removed",
  8: "packing",
  16: "received_money",
}

/** i18n key under `t.pancakeStatus` for each code. */
const STATUS_KEYS = {
  0: "new",
  1: "submitted",
  2: "shipped",
  3: "delivered",
  4: "returning",
  5: "returned",
  6: "canceled",
  7: "removed",
  8: "packing",
  16: "receivedMoney",
} as const

export type PancakeStatusKey = (typeof STATUS_KEYS)[PancakeOrderStatus]

/** i18n key for a code, or null when the code is unknown to us. */
export function statusKey(code: number): PancakeStatusKey | null {
  return STATUS_KEYS[code as PancakeOrderStatus] ?? null
}

/** Raw Pancake `status_name`, or null when the code is unknown to us. */
export function statusName(code: number): string | null {
  return STATUS_NAMES[code] ?? null
}
