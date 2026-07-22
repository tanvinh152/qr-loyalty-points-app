import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { LoyaltyRules, SkuPointMap } from "@/lib/points"
import type {
  AdjustMeta,
  CustomerRow,
  LoyaltySettingsRow,
  MembershipTierRow,
  RewardRow,
  TransactionRow,
  TransactionSource,
  TransactionType,
} from "@/lib/db-types"

// Server-side reads for the claim and account flows. These use the service-role
// client on purpose: product_points, customers and the ledger are not
// anon-readable. Every function here is called from a Server Action or RSC that
// has already rate-limited and (for customer data) established whose data it is
// — the session for the account pages, the masked-phone match for a claim.

/**
 * Reads the staff note off an ADJUST row. `meta` is untyped jsonb and rows
 * written before 0008 have none, so everything is probed rather than asserted.
 */
export function adjustMeta(row: {
  type: TransactionType
  meta: unknown
}): AdjustMeta | null {
  if (row.type !== "ADJUST") return null
  const meta = row.meta
  if (!meta || typeof meta !== "object") return null

  const m = meta as Record<string, unknown>
  const actor =
    m.actor && typeof m.actor === "object"
      ? (m.actor as Record<string, unknown>)
      : null
  const int = (value: unknown) => (typeof value === "number" ? value : 0)

  return {
    reason: typeof m.reason === "string" ? m.reason : "",
    actor: actor?.id
      ? {
          id: String(actor.id),
          email: typeof actor.email === "string" ? actor.email : null,
        }
      : null,
    current_delta: int(m.current_delta),
    lifetime_delta: int(m.lifetime_delta),
    granted_tier_id:
      typeof m.granted_tier_id === "string" ? m.granted_tier_id : null,
  }
}

export type ActiveSettings = LoyaltyRules & {
  claimable_statuses: number[]
}

export async function getActiveSettings(): Promise<ActiveSettings | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("loyalty_settings")
    .select("rounding, claimable_statuses, unmapped_sku_points")
    .eq("is_active", true)
    .maybeSingle<
      Pick<
        LoyaltySettingsRow,
        "rounding" | "claimable_statuses" | "unmapped_sku_points"
      >
    >()

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
  phone: string,
): Promise<CustomerRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle<CustomerRow>()
  return data ?? null
}

// Reverse of the link the RPC writes on a manual claim. The webhook has no real
// phone to go on (Pancake masks it), so this is the ONLY way it can attribute an
// order — and it only resolves for a customer who already proved ownership once.
export async function getCustomerByPancakeId(
  pancakeCustomerId: string,
): Promise<CustomerRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("pancake_customer_id", pancakeCustomerId)
    .maybeSingle<CustomerRow>()
  return data ?? null
}

export async function getCustomerByAuthUserId(
  authUserId: string,
): Promise<CustomerRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle<CustomerRow>()
  return data ?? null
}

// Links a fresh auth user to the (possibly pre-existing) customer row for that
// phone, so points claimed anonymously before signup carry over. Refuses to
// steal a row that already belongs to a different account.
export async function linkAuthUserToPhone(
  authUserId: string,
  phone: string,
): Promise<
  { ok: true; customer: CustomerRow } | { ok: false; reason: "taken" }
> {
  const supabase = createAdminClient()
  const existing = await getCustomerByPhone(phone)

  if (existing?.auth_user_id && existing.auth_user_id !== authUserId) {
    return { ok: false, reason: "taken" }
  }

  const { data, error } = await supabase
    .from("customers")
    .upsert(
      { phone, auth_user_id: authUserId, updated_at: new Date().toISOString() },
      { onConflict: "phone" },
    )
    .select("*")
    .single<CustomerRow>()

  if (error || !data) return { ok: false, reason: "taken" }
  return { ok: true, customer: data }
}

// Reward store listing. Out-of-stock rewards are still shown (greyed out in the
// UI) so the store does not silently shrink.
export async function getActiveRewards({
  category,
}: { category?: string } = {}): Promise<RewardRow[]> {
  const supabase = createAdminClient()
  let query = supabase.from("rewards").select("*").eq("is_active", true)
  // "exclusive" is a pseudo-category on the shop's tab bar: it filters the flag,
  // not the column, so an exclusive reward keeps its real category too.
  if (category === EXCLUSIVE_CATEGORY) query = query.eq("is_exclusive", true)
  else if (category) query = query.eq("category", category)
  const { data } = await query.order("points_cost", { ascending: true })
  return (data ?? []) as RewardRow[]
}

/** The shop tab that filters on `is_exclusive` rather than on `category`. */
export const EXCLUSIVE_CATEGORY = "exclusive"

// Distinct categories in stock, for the shop's tab bar. Done in JS because
// PostgREST has no DISTINCT — the reward catalog is small enough that pulling
// one column and de-duplicating it costs less than a view.
export async function getRewardCategories(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("rewards")
    .select("category")
    .eq("is_active", true)
    .not("category", "is", null)
  const seen = new Set<string>()
  for (const row of data ?? []) {
    const value = (row as { category: string | null }).category
    if (value) seen.add(value)
  }
  return [...seen].sort()
}

// The shop's hero card. A partial unique index guarantees at most one row here.
export async function getFeaturedReward(): Promise<RewardRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("rewards")
    .select("*")
    .eq("is_active", true)
    .eq("is_featured", true)
    .maybeSingle<RewardRow>()
  return data ?? null
}

export type TransactionFilters = {
  page?: number
  pageSize?: number
  /** Matches the order code. Points and dates are not text-searchable. */
  search?: string
  /** Inclusive ISO date (YYYY-MM-DD) bounds on created_at. */
  from?: string
  to?: string
}

/** A ledger row plus the name of the reward it spent points on, when any. */
export type TransactionListRow = TransactionRow & {
  reward: { name: string } | null
}

export async function getTransactions(
  customerId: string,
  { page = 1, pageSize = 10, search, from, to }: TransactionFilters = {},
): Promise<{ rows: TransactionListRow[]; total: number }> {
  const supabase = createAdminClient()
  const offset = (page - 1) * pageSize
  let query = supabase
    .from("transactions")
    // The history screen names the reward a redemption spent points on; the row
    // itself only stores its id.
    .select("*, reward:rewards(name)", { count: "exact" })
    .eq("customer_id", customerId)

  if (search) query = query.ilike("order_code", `%${search}%`)
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`)
  // `to` is an inclusive day, so the bound is the end of it, not midnight.
  if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`)

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1)
  return { rows: (data ?? []) as TransactionListRow[], total: count ?? 0 }
}

export type AdminTransactionFilters = {
  page?: number
  pageSize?: number
  /** Matches the order code or the phone stored on the ledger row. */
  search?: string
  /** Inclusive ISO date (YYYY-MM-DD) bounds on created_at. */
  from?: string
  to?: string
  type?: TransactionType
  source?: TransactionSource
}

/** A ledger row with the customer it belongs to, for the admin table. */
export type AdminTransactionRow = TransactionRow & {
  customers: { full_name: string | null; phone: string } | null
  reward: { name: string } | null
}

export type AdminTransactionResult = {
  rows: AdminTransactionRow[]
  total: number
  /** Totals across the whole filtered set, not just the visible page. */
  issued: number
  redeemed: number
}

/**
 * The admin ledger view: the same filters the customer's history screen offers,
 * but across every customer. Search matches the order code and the phone the
 * row was written with — names live on `customers`, and filtering an embedded
 * resource would force an inner join that drops rows whose customer was
 * deleted.
 */
export async function getAdminTransactions({
  page = 1,
  pageSize = 20,
  search,
  from,
  to,
  type,
  source,
}: AdminTransactionFilters = {}): Promise<AdminTransactionResult> {
  const supabase = createAdminClient()
  const offset = (page - 1) * pageSize

  // Both queries need the same predicate; only the projection differs. The two
  // builders have different PostgREST generics, so the shared step is typed
  // against the four chainable methods it uses and cast back at the call site —
  // a self-referential generic here blows past TypeScript's depth limit.
  type Filterable = {
    or(filters: string): Filterable
    gte(column: string, value: unknown): Filterable
    lte(column: string, value: unknown): Filterable
    eq(column: string, value: unknown): Filterable
  }
  const applyFilters = <T>(query: T): T => {
    let next = query as Filterable
    if (search)
      next = next.or(`order_code.ilike.%${search}%,phone.ilike.%${search}%`)
    if (from) next = next.gte("created_at", `${from}T00:00:00Z`)
    if (to) next = next.lte("created_at", `${to}T23:59:59.999Z`)
    if (type) next = next.eq("type", type)
    if (source) next = next.eq("source", source)
    return next as T
  }

  const [list, ledger] = await Promise.all([
    applyFilters(
      supabase
        .from("transactions")
        .select("*, customers(full_name, phone), reward:rewards(name)", {
          count: "exact",
        }),
    )
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1),
    // The stat row summarises the filter, so it cannot reuse the paged result.
    applyFilters(supabase.from("transactions").select("amount")),
  ])

  let issued = 0
  let redeemed = 0
  for (const row of (ledger.data ?? []) as Pick<TransactionRow, "amount">[]) {
    if (row.amount >= 0) issued += row.amount
    else redeemed += -row.amount
  }

  return {
    rows: (list.data ?? []) as unknown as AdminTransactionRow[],
    total: list.count ?? 0,
    issued,
    redeemed,
  }
}

export type TransactionTotals = {
  count: number
  earned: number
  /** Positive number: the absolute value of everything spent. */
  spent: number
}

// Lifetime totals for the history screen's stat cards. Separate from the paged
// query on purpose — the cards summarise the whole ledger, not the page.
export async function getTransactionTotals(
  customerId: string,
): Promise<TransactionTotals> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("transactions")
    .select("amount")
    .eq("customer_id", customerId)

  let earned = 0
  let spent = 0
  for (const row of (data ?? []) as Pick<TransactionRow, "amount">[]) {
    if (row.amount >= 0) earned += row.amount
    else spent += -row.amount
  }
  return { count: data?.length ?? 0, earned, spent }
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
  currentPoints: number,
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
  lifetimePoints: number,
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

export type TierProgress = {
  current: MembershipTierRow | null
  next: MembershipTierRow | null
  /** Threshold of the current tier — the bar's zero, not the scale's. */
  floor: number
  /** 0-100. Always 100 at the top tier, where there is nothing to fill towards. */
  percent: number
  /** Points still needed to reach `next`. 0 at the top tier. */
  toNext: number
}

/**
 * Progress *inside* the current tier band rather than from zero — otherwise
 * every tier after the first opens on a misleadingly full bar. Shared by the
 * customer dashboard, the tier screen and the admin customer detail page.
 */
export function tierProgress(
  tiers: MembershipTierRow[],
  lifetimePoints: number,
): TierProgress {
  const { current, next } = resolveTiers(tiers, lifetimePoints)
  const floor = current?.threshold ?? 0
  const span = next ? next.threshold - floor : 0
  const percent =
    span > 0
      ? Math.min(100, Math.round(((lifetimePoints - floor) / span) * 100))
      : 100
  return {
    current,
    next,
    floor,
    percent,
    toNext: next ? Math.max(0, next.threshold - lifetimePoints) : 0,
  }
}
