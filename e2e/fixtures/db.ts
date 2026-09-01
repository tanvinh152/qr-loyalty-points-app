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
