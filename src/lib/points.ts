// Shared types for the point-calculation config. The calculation itself lives in
// `claim_points` (supabase/migrations/0011_claim_spend.sql) and nowhere else.
//
// A TypeScript copy of the arithmetic used to sit here "for the admin UI", but
// no admin screen ever called it — only its own test did. A duplicate nobody
// runs cannot catch a divergence; it just creates an obligation to keep two
// implementations in step, which is exactly the risk it was meant to remove.

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
