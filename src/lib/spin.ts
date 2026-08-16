// Pure wheel helpers. Kept out of `loyalty.ts` for the same reason as
// `rewards.ts`: that module pulls in the service-role Supabase client, and the
// prize card is rendered on both sides of the boundary. Nothing here may import
// `server-only`.

/**
 * Stock at or below this counts as "running low" for a `gift` slice. Separate
 * from the shop's LOW_STOCK because a wheel gift is won a unit at a time and
 * usually stocked far shallower than a shop reward.
 */
export const SPIN_LOW_STOCK = 3

// Odds are the wedge's share of the total weight, and the admin reads them as a
// percentage. One decimal, because the long-tail wedge ("1.000 điểm" at 1 of
// 75) rounds to a flat 1% otherwise and stops being distinguishable from the
// next one up.
const oddsFormatter = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 1,
})

/** `share` is a fraction in [0, 1] — weight / sum(weight), not a percentage. */
export function formatOdds(share: number): string {
  return oddsFormatter.format(share)
}

/**
 * Whether a slice can actually come up. The wheel skips inactive slices, slices
 * with no weight, and — since gifts share the shop's `quantity` column (0022) —
 * any sold-out gift. This MUST agree with the filter inside the `spin_wheel`
 * RPC, or the odds the admin sees are not the odds the server rolls.
 */
export function isDrawable(prize: {
  is_active: boolean
  weight: number
  prize_type: string
  quantity: number
}): boolean {
  if (!prize.is_active || prize.weight <= 0) return false
  return prize.prize_type !== "gift" || prize.quantity > 0
}
