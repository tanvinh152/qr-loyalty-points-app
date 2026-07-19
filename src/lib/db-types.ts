import type { Rounding } from "@/lib/points"

// Hand-maintained mirror of supabase/migrations/0001_schema.sql.

export type TransactionType = "EARN" | "REDEEM" | "ADJUST"
export type TransactionSource = "claim" | "webhook" | "admin"

export type LoyaltySettingsRow = {
  id: string
  rounding: Rounding
  claimable_statuses: number[]
  unmapped_sku_points: number
  is_active: boolean
  updated_at: string
}

export type MembershipTierRow = {
  id: string
  name: string
  threshold: number
  multiplier: number
  sort_order: number
  benefits: string | null
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
  quantity: number
  image_url: string | null
  is_active: boolean
  created_at: string
}

export type CustomerRow = {
  id: string
  auth_user_id: string | null
  phone: string
  email: string | null
  full_name: string | null
  pancake_customer_id: string | null
  current_points: number
  lifetime_points: number
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

// Return shape of the claim_points RPC.
export type ClaimResult = {
  points_awarded: number
  current_points: number
  lifetime_points: number
  tier_name: string | null
  tier_upgraded: boolean
}
