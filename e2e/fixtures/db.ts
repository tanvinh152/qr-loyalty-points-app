import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { SERVICE_ROLE_KEY, SUPABASE_URL, assertLocalTarget } from "../env"

/**
 * Direct, service-role access to the test database.
 *
 * Specs use this for two things the browser cannot do: pinning preconditions in
 * `beforeEach` (so they are order-independent even though they share one
 * database), and asserting the DATABASE result rather than only the toast —
 * C-RWD-01 wants to see a reward's `quantity` drop, which no screen shows.
 */

let client: SupabaseClient | null = null

export function db(): SupabaseClient {
  assertLocalTarget()
  client ??= createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

export async function setPoints(customerId: string, points: number) {
  const { error } = await db()
    .from("customers")
    .update({ current_points: points })
    .eq("id", customerId)
  if (error) throw new Error(`setPoints: ${error.message}`)
}

/**
 * Pins arbitrary columns on a member.
 *
 * The general form of `setPoints`/`setTier`, for specs that need to establish a
 * whole starting position (balance AND spend AND tier AND the POS link) in one
 * statement rather than three round trips.
 */
export async function setCustomer(
  customerId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await db()
    .from("customers")
    .update(patch)
    .eq("id", customerId)
  if (error) throw new Error(`setCustomer: ${error.message}`)
}

export async function setTier(customerId: string, tierName: string | null) {
  const tierId = tierName ? await tierIdByName(tierName) : null
  const { error } = await db()
    .from("customers")
    .update({ tier_id: tierId })
    .eq("id", customerId)
  if (error) throw new Error(`setTier: ${error.message}`)
}

export async function tierIdByName(name: string): Promise<string> {
  const { data, error } = await db()
    .from("membership_tiers")
    .select("id")
    .eq("name", name)
    .single()
  if (error) throw new Error(`tierIdByName(${name}): ${error.message}`)
  return data.id as string
}

export async function setReward(
  rewardId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await db().from("rewards").update(patch).eq("id", rewardId)
  if (error) throw new Error(`setReward: ${error.message}`)
}

export async function readCustomer(customerId: string) {
  const { data, error } = await db()
    .from("customers")
    .select("current_points, lifetime_points, lifetime_spend, tier_id")
    .eq("id", customerId)
    .single()
  if (error) throw new Error(`readCustomer: ${error.message}`)
  return data
}

export async function readReward(rewardId: string) {
  const { data, error } = await db()
    .from("rewards")
    .select("quantity, is_active, points_cost")
    .eq("id", rewardId)
    .single()
  if (error) throw new Error(`readReward: ${error.message}`)
  return data
}

export async function readTransactions(customerId: string) {
  const { data, error } = await db()
    .from("transactions")
    .select("type, amount, source, meta, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`readTransactions: ${error.message}`)
  return data
}

/** Wipes every ledger row for one member, so a spec starts from a clean slate. */
export async function clearTransactions(customerId: string) {
  const { error } = await db()
    .from("transactions")
    .delete()
    .eq("customer_id", customerId)
  if (error) throw new Error(`clearTransactions: ${error.message}`)
}

/**
 * Patches the single active `loyalty_settings` row.
 *
 * Two of its columns are feature switches, and `seed.sql` leaves both at 0:
 * `checkin_points` hides the dashboard check-in tile, `spin_daily_limit` turns
 * the wheel off everywhere. A spec for either feature must switch it on first,
 * and switch it back after, or it changes what every later spec renders.
 */
export async function setSettings(patch: Record<string, unknown>) {
  const { error } = await db()
    .from("loyalty_settings")
    .update(patch)
    .eq("is_active", true)
  if (error) throw new Error(`setSettings: ${error.message}`)
}

export async function readSettings() {
  const { data, error } = await db()
    .from("loyalty_settings")
    .select("*")
    .eq("is_active", true)
    .single()
  if (error) throw new Error(`readSettings: ${error.message}`)
  return data
}

/** Forgets today's check-in, so the same member can check in again. */
export async function clearCheckins(customerId: string) {
  const { error } = await db()
    .from("customer_checkins")
    .delete()
    .eq("customer_id", customerId)
  if (error) throw new Error(`clearCheckins: ${error.message}`)
}

/**
 * Replaces the wheel's wedges with exactly the ones a spec wants.
 *
 * A spin is weighted-random, so the only way to assert an OUTCOME is to leave
 * the wheel no choice: one active wedge carrying all the weight. The seeded
 * wedges are deactivated rather than deleted — they belong to `seed.sql` and
 * `restoreSeedSpinPrizes()` puts them back.
 */
export async function useOnlySpinPrize(patch: Record<string, unknown>) {
  const { error: off } = await db()
    .from("rewards")
    .update({ is_active: false })
    .eq("kind", "spin")
  if (off) throw new Error(`useOnlySpinPrize(off): ${off.message}`)

  const { data, error } = await db()
    .from("rewards")
    .insert({
      kind: "spin",
      points_cost: 0,
      weight: 100,
      is_active: true,
      ...patch,
    })
    .select("id")
    .single()
  if (error) throw new Error(`useOnlySpinPrize: ${error.message}`)
  return data.id as string
}

/** Drops every wedge a spec created and re-activates the seeded ones. */
export async function restoreSeedSpinPrizes() {
  await db().from("spin_results").delete().gte("created_at", "1970-01-01T00:00:00Z")
  const { error } = await db()
    .from("rewards")
    .delete()
    .eq("kind", "spin")
    .like("name", "E2E %")
  if (error) throw new Error(`restoreSeedSpinPrizes: ${error.message}`)
  await db().from("rewards").update({ is_active: true }).eq("kind", "spin")
}

/** Every wheel result for one member, newest first. */
export async function readSpinResults(customerId: string) {
  const { data, error } = await db()
    .from("spin_results")
    .select("prize_name, prize_type, points_awarded, fulfilled_at, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`readSpinResults: ${error.message}`)
  return data
}

/** Every milestone award this member holds, newest first. */
export async function readMilestoneAwards(customerId: string) {
  const { data, error } = await db()
    .from("milestone_awards")
    .select("milestone_id, milestone_name, threshold_amount, spend_at_claim, fulfilled_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`readMilestoneAwards: ${error.message}`)
  return data
}

export async function clearMilestoneAwards(customerId: string) {
  const { error } = await db()
    .from("milestone_awards")
    .delete()
    .eq("customer_id", customerId)
  if (error) throw new Error(`clearMilestoneAwards: ${error.message}`)
}

/**
 * Narrows the spend ladder to the rungs a spec defines.
 *
 * `seed.sql` ships seven rungs from 400k to 8,35tr, which makes "the next rung"
 * and "how many are claimable" depend on values this file does not own. The
 * seeded ones are deactivated (not deleted) and `restoreSeedMilestones()` puts
 * them back.
 */
export async function useOnlyMilestones(
  rungs: { name: string; spend_threshold: number }[],
) {
  const { error: off } = await db()
    .from("rewards")
    .update({ is_active: false })
    .eq("kind", "milestone")
  if (off) throw new Error(`useOnlyMilestones(off): ${off.message}`)

  const { data, error } = await db()
    .from("rewards")
    .insert(
      rungs.map((rung) => ({
        kind: "milestone",
        points_cost: 0,
        is_active: true,
        ...rung,
      })),
    )
    .select("id, spend_threshold")
  if (error) throw new Error(`useOnlyMilestones: ${error.message}`)
  return data
}

export async function restoreSeedMilestones() {
  const { error } = await db()
    .from("rewards")
    .delete()
    .eq("kind", "milestone")
    .like("name", "E2E %")
  if (error) throw new Error(`restoreSeedMilestones: ${error.message}`)
  await db().from("rewards").update({ is_active: true }).eq("kind", "milestone")
}

/**
 * Removes every queued tier-threshold raise.
 *
 * `tier_schedule_one_pending` allows a single unapplied schedule per tier, so a
 * row left behind by a previous spec makes the NEXT insert fail with 23505
 * rather than failing the spec that caused it.
 */
export async function clearSchedules() {
  const { error } = await db()
    .from("tier_threshold_schedules")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z")
  if (error) throw new Error(`clearSchedules: ${error.message}`)
}

/**
 * Empties both brute-force counters.
 *
 * The login spec deliberately submits wrong passwords, and `signIn` books every
 * failure against the caller's IP (`claim_attempts`, 0021's
 * `admin_login_attempts` for staff). Every spec in the run shares one IP, so
 * after five deliberate failures the suite throttles ITSELF and every later
 * sign-in — including the storageState setup — is refused with "too many
 * attempts". Clearing them is not tidiness; without it the suite cannot be run
 * twice in fifteen minutes.
 */
export async function clearRateLimits() {
  for (const table of ["claim_attempts", "admin_login_attempts"]) {
    const { error } = await db()
      .from(table)
      .delete()
      .gte("created_at", "1970-01-01T00:00:00Z")
    if (error) throw new Error(`clearRateLimits(${table}): ${error.message}`)
  }
}
