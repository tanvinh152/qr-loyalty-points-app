import type { Rounding } from "@/lib/points"

// Hand-maintained mirror of supabase/migrations/0001_schema.sql.

export type TransactionType = "EARN" | "REDEEM" | "ADJUST"
export type TransactionSource = "claim" | "webhook" | "admin" | "redeem"

export type LoyaltySettingsRow = {
  id: string
  rounding: Rounding
  claimable_statuses: number[]
  unmapped_sku_points: number
  is_active: boolean
  updated_at: string
}

/** One row of the tier screen's benefit grid. Stored in `membership_tiers.perks`. */
export type TierPerk = {
  /** Key into the tier page's icon map, not a component name. */
  icon: string
  title: string
  detail: string | null
}

export type MembershipTierRow = {
  id: string
  name: string
  /** Lifetime SPEND in đồng required to reach this tier — never points (0010). */
  spend_threshold: number
  multiplier: number
  sort_order: number
  /** Legacy free text, still edited in admin. `perks` is what the UI renders. */
  benefits: string | null
  perks: TierPerk[]
  created_at: string
}

export type ProductPointRow = {
  id: string
  product_code: string
  label: string | null
  points_awarded: number
  is_active: boolean
  updated_at: string
}

export type RewardRow = {
  id: string
  name: string
  description: string | null
  points_cost: number
  /** Struck-through "was" price on the shop card. Null = no discount. */
  original_points_cost: number | null
  quantity: number
  image_url: string | null
  /** Free-text slug; the shop's tab bar is built from the distinct values. */
  category: string | null
  is_exclusive: boolean
  /** At most one active reward may carry this — enforced by a partial index. */
  is_featured: boolean
  is_active: boolean
  created_at: string
}

export type PetType = "dog" | "cat" | "other"

export type CustomerRow = {
  id: string
  auth_user_id: string | null
  phone: string
  email: string | null
  full_name: string | null
  date_of_birth: string | null
  pet_name: string | null
  pet_type: PetType | null
  pet_dob: string | null
  /** Set on the first successful profile save; never reset on later edits. */
  profile_completed_at: string | null
  pancake_customer_id: string | null
  current_points: number
  lifetime_points: number
  /** Money ever spent, in đồng. The tier ladder is measured against this. */
  lifetime_spend: number
  /** Highest tier ever held, not the tier the current spend earns. Sticky. */
  tier_id: string | null
  created_at: string
  updated_at: string
}

export type TransactionRow = {
  id: string
  customer_id: string
  phone: string
  type: TransactionType
  amount: number
  order_code: string | null
  source: TransactionSource
  reward_id: string | null
  meta: unknown
  created_at: string
}

/**
 * `meta` on an ADJUST row, written by the adjust_points RPC (0008). `amount` on
 * the row itself only carries the spendable half, so the tier grant and the
 * lifetime movement are only legible here.
 */
export type AdjustMeta = {
  reason: string
  actor: { id: string; email: string | null } | null
  current_delta: number
  lifetime_delta: number
  granted_tier_id: string | null
}

/** Return shape of the adjust_points RPC. */
export type AdjustResult = {
  current_points: number
  lifetime_points: number
  tier_name: string | null
  tier_changed: boolean
}

// Return shape of the claim_points RPC.
export type ClaimResult = {
  points_awarded: number
  current_points: number
  lifetime_points: number
  lifetime_spend: number
  tier_name: string | null
  tier_upgraded: boolean
}

export type TierScheduleMode = "amount" | "percentile"

/**
 * A queued threshold raise (0010). At most one may be pending per tier.
 * `resolved_amount` is written when it fires and is the audit trail of what a
 * percentile rule meant on the day it applied.
 */
export type TierScheduleRow = {
  id: string
  tier_id: string
  mode: TierScheduleMode
  target_amount: number | null
  target_percentile: number | null
  resolved_amount: number | null
  effective_at: string
  applied_at: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

/**
 * One tier award. `tier_name` and `threshold_amount` are SNAPSHOTS: they say
 * what was true the day the tier was earned, which is the whole point — it is
 * how a grandfathered member's tier can be explained after a raise.
 */
export type CustomerTierHistoryRow = {
  id: string
  customer_id: string
  tier_id: string | null
  tier_name: string
  threshold_amount: number
  spend_at_award: number
  source: "claim" | "webhook" | "admin"
  awarded_at: string
}

/** Return shape of the apply_due_tier_schedules RPC. */
export type ApplyScheduleResult = {
  applied: {
    schedule_id: string
    tier_id: string
    tier_name: string | null
    from: number
    to: number
  }[]
}

export type SupportRequestStatus = "open" | "closed"

export type SupportRequestRow = {
  id: string
  customer_id: string | null
  name: string
  email: string
  topic: string
  message: string
  status: SupportRequestStatus
  created_at: string
}

// Return shape of the update_customer_profile RPC. Deliberately narrow: the RPC
// cannot touch points or tier, so it has nothing else to report back.
export type ProfileUpdateResult = {
  full_name: string | null
  date_of_birth: string | null
  pet_name: string | null
  pet_type: PetType | null
  pet_dob: string | null
}
