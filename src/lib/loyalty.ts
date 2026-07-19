import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { LoyaltyRules, SkuPointMap } from "@/lib/points"
import type {
  CustomerRow,
  LoyaltySettingsRow,
  MembershipTierRow,
  RewardRow,
} from "@/lib/db-types"

// Server-side reads for the claim flow. These use the service-role client on
// purpose: product_points, customers and the ledger are not anon-readable, and
// the /claim page is anonymous. Every function here is called from a Server
// Action that has already rate-limited and (for customer data) verified the
// masked-phone match.

export type ActiveSettings = LoyaltyRules & {
  claimable_statuses: number[]
}

export async function getActiveSettings(): Promise<ActiveSettings | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("loyalty_settings")
    .select("rounding, claimable_statuses, unmapped_sku_points")
    .eq("is_active", true)
    .maybeSingle<Pick<
      LoyaltySettingsRow,
      "rounding" | "claimable_statuses" | "unmapped_sku_points"
    >>()

  if (!data) return null
  return {
    rounding: data.rounding,
    unmapped_sku_points: data.unmapped_sku_points,
    claimable_statuses: data.claimable_statuses ?? [3],
  }
}

// SKU -> points, active mappings only. Fetches just the SKUs on the order.
export async function getSkuPoints(skus: string[]): Promise<SkuPointMap> {
  const unique = [...new Set(skus.filter(Boolean))]
  if (unique.length === 0) return {}

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("product_points")
    .select("product_code, points_awarded")
    .eq("is_active", true)
    .in("product_code", unique)

  const map: SkuPointMap = {}
  for (const row of data ?? []) map[row.product_code] = row.points_awarded
  return map
}

export async function getTiers(): Promise<MembershipTierRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("membership_tiers")
    .select("*")
    .order("threshold", { ascending: true })
  return (data ?? []) as MembershipTierRow[]
}

export async function getCustomerByPhone(
  phone: string
): Promise<CustomerRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle<CustomerRow>()
  return data ?? null
}

export async function isOrderClaimed(orderCode: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .eq("order_code", orderCode)
    .maybeSingle()
  return Boolean(data)
}

// Cheapest reward the customer cannot afford yet — the "X points away" nudge.
export async function getNextReward(
  currentPoints: number
): Promise<RewardRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("rewards")
    .select("*")
    .eq("is_active", true)
    .gt("quantity", 0)
    .gt("points_cost", currentPoints)
    .order("points_cost", { ascending: true })
    .limit(1)
    .maybeSingle<RewardRow>()
  return data ?? null
}

// Tier the customer sits in now, plus the next one up (null at the top tier).
export function resolveTiers(
  tiers: MembershipTierRow[],
  lifetimePoints: number
): { current: MembershipTierRow | null; next: MembershipTierRow | null } {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold)
  let current: MembershipTierRow | null = null
  let next: MembershipTierRow | null = null
  for (const tier of sorted) {
    if (tier.threshold <= lifetimePoints) current = tier
    else if (!next) next = tier
  }
  return { current, next }
}
