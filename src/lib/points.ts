// Shared types for the point-calculation config. The calculation itself lives in
// `claim_points` (supabase/migrations/0025_spend_based_points.sql) and nowhere
// else.
//
// A TypeScript copy of the arithmetic used to sit here "for the admin UI", but
// no admin screen ever called it — only its own test did. A duplicate nobody
// runs cannot catch a divergence; it just creates an obligation to keep two
// implementations in step, which is exactly the risk it was meant to remove.

export type Rounding = "floor" | "round" | "ceil"

export type LoyaltyRules = {
  /**
   * Governs the TIER MULTIPLIER step only. The đồng -> base-point division is
   * always floor, so a member is never credited money they did not spend.
   */
  rounding: Rounding
  /** Đồng of actually-paid money per 1 base point. §5.1 sets this to 1000. */
  vnd_per_point: number
}

// Still carried to `claim_points` and stored in `meta.items`: it is the only
// per-line audit trail the ledger has, even though points are now computed from
// the order total rather than per SKU.
export type ClaimItem = {
  sku: string | null
  quantity: number
}
