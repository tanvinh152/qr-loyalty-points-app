// Single source of truth for point calculation on the TS side.
// MUST match the SQL logic in supabase/migrations/0003_claim_rpc.sql.
// The RPC recomputes server-side and is authoritative; this is for the /claim
// preview and admin UI only.

export type Rounding = "floor" | "round" | "ceil"

export type LoyaltyRules = {
  rounding: Rounding
  unmapped_sku_points: number
}

export type ClaimItem = {
  sku: string | null
  quantity: number
}

// product_code -> points_awarded (active rows only).
export type SkuPointMap = Record<string, number>

export function pointsForItem(
  item: ClaimItem,
  skuMap: SkuPointMap,
  rules: LoyaltyRules
): number {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) return 0
  const mapped = item.sku ? skuMap[item.sku] : undefined
  return item.quantity * (mapped ?? rules.unmapped_sku_points)
}

// Base points before the tier multiplier: sum(qty × points per SKU).
export function calcBasePoints(
  items: ClaimItem[],
  skuMap: SkuPointMap,
  rules: LoyaltyRules
): number {
  return items.reduce((sum, item) => sum + pointsForItem(item, skuMap, rules), 0)
}

export function applyRounding(value: number, rounding: Rounding): number {
  switch (rounding) {
    case "floor":
      return Math.floor(value)
    case "ceil":
      return Math.ceil(value)
    default:
      return Math.round(value)
  }
}

export function calcOrderPoints(
  items: ClaimItem[],
  skuMap: SkuPointMap,
  multiplier: number,
  rules: LoyaltyRules
): number {
  const base = calcBasePoints(items, skuMap, rules)
  return applyRounding(base * (multiplier > 0 ? multiplier : 1), rules.rounding)
}
