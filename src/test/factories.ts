import type { MembershipTierRow, RewardRow } from "@/lib/db-types"

/**
 * Row builders for the shapes several test files need. Each returns a COMPLETE
 * row, so a test only names the columns it is actually about — which is what
 * makes the interesting value visible at the call site instead of buried in
 * twenty lines of scaffolding.
 */

export function tier(over: Partial<MembershipTierRow> = {}): MembershipTierRow {
  return {
    id: "tier-silver",
    name: "Bạc",
    spend_threshold: 0,
    multiplier: 1,
    sort_order: 1,
    benefits: null,
    perks: [],
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  }
}

export function reward(over: Partial<RewardRow> = {}): RewardRow {
  return {
    id: "reward-1",
    kind: "redeem",
    name: "Voucher 50.000đ",
    description: null,
    points_cost: 500,
    quantity: 10,
    image_url: null,
    category: null,
    is_exclusive: false,
    is_featured: false,
    is_active: true,
    min_tier_id: null,
    created_at: "2026-01-01T00:00:00Z",
    // Columns that belong to the other two kinds. The check constraints keep
    // them at these defaults on a `redeem` row.
    prize_type: "none",
    points_amount: 0,
    weight: 0,
    sort_order: 0,
    spend_threshold: null,
    ...over,
  }
}
