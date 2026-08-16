import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { isDrawable } from "@/lib/spin"
import type { LoyaltyRules, SkuPointMap } from "@/lib/points"
import type {
  AdjustMeta,
  CustomerRow,
  CustomerTierHistoryRow,
  LoyaltySettingsRow,
  MembershipTierRow,
  RewardRow,
  SpinResultRow,
  TierScheduleRow,
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
    // No fallback: the column is `not null`, and a third default sitting here
    // would only be a third answer to disagree with the DB default and with
    // DEFAULT_CLAIMABLE_STATUSES.
    claimable_statuses: data.claimable_statuses,
  }
}

// 0 means the admin has not turned the feature on — callers hide the check-in
// card entirely rather than showing a button that always fails.
export async function getCheckinPoints(): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("loyalty_settings")
    .select("checkin_points")
    .eq("is_active", true)
    .maybeSingle<Pick<LoyaltySettingsRow, "checkin_points">>()
  return data?.checkin_points ?? 0
}

// Today's check-in, VN calendar day — the same boundary the checkin RPC uses
// (`now() at time zone 'Asia/Ho_Chi_Minh'`). Computed in JS via en-CA, which is
// the one Intl locale that formats a date as YYYY-MM-DD.
export function todayInVietnam(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  })
}

export async function hasCheckedInToday(customerId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("customer_checkins")
    .select("id")
    .eq("customer_id", customerId)
    .eq("checkin_date", todayInVietnam())
    .maybeSingle()
  return Boolean(data)
}

// 0 means the wheel is off; callers hide the whole feature rather than showing
// a spin button that always fails.
export async function getSpinDailyLimit(): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("loyalty_settings")
    .select("spin_daily_limit")
    .eq("is_active", true)
    .maybeSingle<Pick<LoyaltySettingsRow, "spin_daily_limit">>()
  return data?.spin_daily_limit ?? 0
}

// How many spins the member has already used today, on the same VN calendar day
// the spin_wheel RPC counts against. The RPC is still the authority — this is
// only what the page renders before the first click.
export async function getSpinsUsedToday(customerId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from("spin_results")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("spin_date", todayInVietnam())
  return count ?? 0
}

/**
 * The wedges the wheel renders, ordered `sort_order, id` — the same order as
 * `rewards_spin_draw_idx`, the running-total window inside `spin_wheel`, and
 * the admin's own list on /admin/rewards. The animation finds its wedge by the
 * id the RPC returned, so a drifted order would not misplace a prize; keeping
 * the three in step is so that "position 3" means one thing everywhere.
 *
 * Only drawable slices are returned. A wedge nobody can land on is a lie told
 * to the member, and `isDrawable` is the same predicate the RPC filters on.
 */
export async function getSpinPrizes(): Promise<RewardRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("rewards")
    .select("*")
    .eq("kind", "spin")
    .eq("is_active", true)
    .gt("weight", 0)
    .order("sort_order")
    .order("id")
  // The sold-out-gift half of the predicate needs the row in hand, so it is
  // applied here rather than as a third `.eq`.
  return ((data ?? []) as RewardRow[]).filter(isDrawable)
}

/**
 * A member's own wins, newest first. Reads the frozen `prize_*` columns and
 * never joins back to `rewards`: what someone won must keep reading the way it
 * read the day they won it, even after the slice is renamed or deleted.
 */
export async function getSpinHistory(
  customerId: string,
  limit = 10,
): Promise<SpinResultRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("spin_results")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as SpinResultRow[]
}

// Gift wins still sitting at the counter. Only 'gift' prizes are ever settled
// by hand — a points win is credited by the RPC and a 'none' leaves no debt.
export async function getUncollectedGiftCount(
  customerId: string,
): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from("spin_results")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("prize_type", "gift")
    .is("fulfilled_at", null)
  return count ?? 0
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
    .order("spend_threshold", { ascending: true })
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
//
// THROWS on a database error rather than answering null. "Nobody is linked" and
// "we could not find out" are opposite answers here: the first is a conclusion
// the signup gate and the webhook are allowed to act on, the second is an
// outage. Conflating them let a blip open the account-takeover gate and made the
// webhook reply 200 unknown_customer — which Pancake never retries, so the
// points were gone for good.
export async function getCustomerByPancakeId(
  pancakeCustomerId: string,
): Promise<CustomerRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("pancake_customer_id", pancakeCustomerId)
    .maybeSingle<CustomerRow>()
  if (error) {
    throw new Error(`getCustomerByPancakeId failed: ${error.message}`)
  }
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
//
// `email` is what sign-in later resolves this phone to, so it is written here
// rather than left to `claim_points` — that RPC is skipped entirely when the
// proof order is not settled yet, and its upsert only ever FILLS a null. A row
// whose email disagrees with `auth.users.email` cannot be signed into at all,
// so this write has to happen on the unconditional path. Omitted when blank so
// no caller can blank a column that is the account's way back in.
export async function linkAuthUserToPhone(
  authUserId: string,
  phone: string,
  email?: string | null,
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
      {
        phone,
        auth_user_id: authUserId,
        ...(email ? { email } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    )
    .select("*")
    .single<CustomerRow>()

  if (error || !data) return { ok: false, reason: "taken" }
  return { ok: true, customer: data }
}

/** Why a link write did not happen. */
export type LinkFailure =
  /** Another account already holds this POS customer (unique index, 23505). */
  | "conflict"
  /** This customer is already linked to a DIFFERENT POS customer. */
  | "mismatch"
  | "error"

export type LinkResult = { ok: true } | { ok: false; reason: LinkFailure }

/**
 * Writes the Pancake link the webhook attributes orders by.
 *
 * `claim_points` sets it as a side effect of a successful claim, but signup must
 * link even when the proof order was already claimed (or is not settled yet), so
 * this is called unconditionally afterwards. Only fills a NULL — it must never
 * repoint an existing link at another POS record.
 *
 * Reports its outcome instead of returning void. An account that finishes signup
 * unlinked is invisible to the webhook forever, and that used to happen without
 * a single log line: `.is(..., null)` simply matched no rows and the update
 * "succeeded".
 *
 * Idempotent. Matching no rows is the NORMAL result when the proof order was
 * claimable, because `claim_points` has already written the same link on its way
 * through; only a row pointing at a *different* POS customer is a failure.
 */
export async function linkPancakeCustomer(
  customerId: string,
  pancakeCustomerId: string,
): Promise<LinkResult> {
  const supabase = createAdminClient()
  const { error, count } = await supabase
    .from("customers")
    .update(
      {
        pancake_customer_id: pancakeCustomerId,
        updated_at: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("id", customerId)
    .is("pancake_customer_id", null)

  if (error) {
    // 23505 = customers_pancake_idx. Somebody else won the race for this POS
    // customer between the signup gate and here.
    const reason: LinkFailure = error.code === "23505" ? "conflict" : "error"
    console.error("[loyalty] link failed", customerId, reason, error)
    return { ok: false, reason }
  }

  if (count !== 0) return { ok: true }

  // Nothing to fill means the column was already set. Read it back rather than
  // guess which of the two reasons applies.
  const { data, error: readError } = await supabase
    .from("customers")
    .select("pancake_customer_id")
    .eq("id", customerId)
    .maybeSingle<{ pancake_customer_id: string | null }>()

  if (readError) {
    console.error("[loyalty] link read-back failed", customerId, readError)
    return { ok: false, reason: "error" }
  }
  if (data?.pancake_customer_id === pancakeCustomerId) return { ok: true }

  console.error(
    "[loyalty] link refused: customer already points at another POS record",
    customerId,
    { want: pancakeCustomerId, have: data?.pancake_customer_id ?? null },
  )
  return { ok: false, reason: "mismatch" }
}

// Reward store listing. Out-of-stock rewards are still shown (greyed out in the
// UI) so the store does not silently shrink.
//
// `kind = 'redeem'` is not optional here or in any other shop query below: the
// wheel's slices share this table since 0022, and dropping the filter puts
// "Chúc bạn may mắn lần sau" on the storefront.
export async function getActiveRewards({
  category,
}: { category?: string } = {}): Promise<RewardRow[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from("rewards")
    .select("*")
    .eq("kind", "redeem")
    .eq("is_active", true)
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
    .eq("kind", "redeem")
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
    .eq("kind", "redeem")
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

// THROWS on a database error, like getCustomerByPancakeId and for the same
// reason: this runs on the webhook path, where a swallowed error reads as "not
// claimed yet" and the caller has no way to tell an answer from an outage.
export async function isOrderClaimed(orderCode: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("order_code", orderCode)
    .maybeSingle()
  if (error) throw new Error(`isOrderClaimed failed: ${error.message}`)
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
    .eq("kind", "redeem")
    .eq("is_active", true)
    .gt("quantity", 0)
    .gt("points_cost", currentPoints)
    .order("points_cost", { ascending: true })
    .limit(1)
    .maybeSingle<RewardRow>()
  return data ?? null
}

// Tier the spend alone earns, plus the next one up (null at the top tier).
// Measured in đồng since 0010 — points no longer decide a tier.
export function resolveTiers(
  tiers: MembershipTierRow[],
  lifetimeSpend: number,
): { current: MembershipTierRow | null; next: MembershipTierRow | null } {
  const sorted = [...tiers].sort((a, b) => a.spend_threshold - b.spend_threshold)
  let current: MembershipTierRow | null = null
  let next: MembershipTierRow | null = null
  for (const tier of sorted) {
    if (tier.spend_threshold <= lifetimeSpend) current = tier
    else if (!next) next = tier
  }
  return { current, next }
}

/**
 * The tier to SHOW: the higher of the one stored on the customer and the one
 * their spend earns today.
 *
 * `customers.tier_id` is the highest tier ever held (0010) and thresholds only
 * ever rise, so after a raise a member's stored tier can outrank what their
 * spend would earn now. That is deliberate — they keep it — and the UI must
 * never contradict the database by rendering the lower one. The reverse case
 * (stored tier behind the spend) happens between an order landing and the RPC
 * that promotes them, and resolves the same way.
 */
export function resolveDisplayTier(
  tiers: MembershipTierRow[],
  customer: Pick<CustomerRow, "tier_id" | "lifetime_spend">,
): MembershipTierRow | null {
  const stored = tiers.find((tier) => tier.id === customer.tier_id) ?? null
  const earned = resolveTiers(tiers, customer.lifetime_spend).current
  if (!stored) return earned
  if (!earned) return stored
  return earned.spend_threshold > stored.spend_threshold ? earned : stored
}

export type TierProgress = {
  current: MembershipTierRow | null
  next: MembershipTierRow | null
  /** Threshold of the current tier — the bar's zero, not the scale's. */
  floor: number
  /** 0-100. Always 100 at the top tier, where there is nothing to fill towards. */
  percent: number
  /** Đồng still needed to reach `next`. 0 at the top tier. */
  toNext: number
}

/**
 * Progress *inside* the current tier band rather than from zero — otherwise
 * every tier after the first opens on a misleadingly full bar. Shared by the
 * customer dashboard, the tier screen and the admin customer detail page.
 *
 * `current` is the DISPLAY tier when a customer is passed, so a grandfathered
 * member's bar starts at the tier they hold rather than the one their spend
 * currently reaches.
 */
export function tierProgress(
  tiers: MembershipTierRow[],
  lifetimeSpend: number,
  customer?: Pick<CustomerRow, "tier_id" | "lifetime_spend">,
): TierProgress {
  const earned = resolveTiers(tiers, lifetimeSpend)
  const current = customer ? resolveDisplayTier(tiers, customer) : earned.current
  // The next rung is the cheapest tier above whichever one is being shown, so a
  // grandfathered member is not told to aim at a tier they already hold.
  const floor = current?.spend_threshold ?? 0
  const next =
    [...tiers]
      .sort((a, b) => a.spend_threshold - b.spend_threshold)
      .find((tier) => tier.spend_threshold > floor) ?? null

  const span = next ? next.spend_threshold - floor : 0
  const percent =
    span > 0
      ? Math.min(100, Math.max(0, Math.round(((lifetimeSpend - floor) / span) * 100)))
      : 100
  return {
    current,
    next,
    floor,
    percent,
    toNext: next ? Math.max(0, next.spend_threshold - lifetimeSpend) : 0,
  }
}

/** Pending (unapplied) threshold raises, keyed by tier id, for /admin/tiers. */
export async function getPendingTierSchedules(): Promise<
  Record<string, TierScheduleRow>
> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("tier_threshold_schedules")
    .select("*")
    .is("applied_at", null)
    .order("effective_at", { ascending: true })

  const map: Record<string, TierScheduleRow> = {}
  for (const row of (data ?? []) as TierScheduleRow[]) map[row.tier_id] = row
  return map
}

/**
 * The award that explains the tier a customer currently holds. Used to show
 * "kept at the old threshold" when the ladder has moved on beneath them.
 */
export async function getLatestTierAward(
  customerId: string,
  tierId: string | null,
): Promise<CustomerTierHistoryRow | null> {
  if (!tierId) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("customer_tier_history")
    .select("*")
    .eq("customer_id", customerId)
    .eq("tier_id", tierId)
    .order("awarded_at", { ascending: false })
    .limit(1)
    .maybeSingle<CustomerTierHistoryRow>()
  return data ?? null
}
