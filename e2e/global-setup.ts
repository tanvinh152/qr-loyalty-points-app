import { createClient } from "@supabase/supabase-js"

import { SERVICE_ROLE_KEY, SUPABASE_URL, assertLocalTarget } from "./env"
import { ADMIN, MEMBER, MEMBER_B, TEST_REWARD } from "./fixtures/accounts"
import { clearRateLimits } from "./fixtures/db"

/**
 * Provisions the two identities the suite runs as, plus the reward the
 * redemption specs drive.
 *
 * Deliberately NOT done in `supabase/seed.sql`. Creating a Supabase auth user
 * from SQL means hand-writing `auth.users` and `auth.identities` rows with a
 * `crypt()`ed password — a private schema shape that breaks on a CLI upgrade.
 * Calling `auth.admin.createUser` is exactly what production signup does
 * (`signUp` in `src/app/(customer)/auth/actions.ts`), so these accounts behave
 * like real ones, including the phone -> email resolution `signIn` relies on.
 *
 * Idempotent: every run deletes the previous auth users first.
 */
export default async function globalSetup() {
  assertLocalTarget()

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const emails = new Set<string>([ADMIN.email, MEMBER.email, MEMBER_B.email])
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const user of existing?.users ?? []) {
    if (user.email && emails.has(user.email)) {
      await admin.auth.admin.deleteUser(user.id)
    }
  }

  async function createUser(
    email: string,
    password: string,
    id?: string,
    isAdmin = false,
  ) {
    const { data, error } = await admin.auth.admin.createUser({
      // Nothing is ever mailed by this app; confirming here mirrors signUp.
      email,
      password,
      email_confirm: true,
      // app_metadata is service-role writable ONLY, which is the whole basis of
      // public.is_admin(). A customer can never carry this.
      app_metadata: isAdmin ? { role: "admin" } : {},
      ...(id ? { id } : {}),
    })
    if (error) throw new Error(`createUser(${email}): ${error.message}`)
    return data.user!.id
  }

  await createUser(ADMIN.email, ADMIN.password, undefined, true)
  await createUser(MEMBER.email, MEMBER.password, MEMBER.authId)
  await createUser(MEMBER_B.email, MEMBER_B.password, MEMBER_B.authId)

  const { data: silver } = await admin
    .from("membership_tiers")
    .select("id")
    .eq("name", "Bạc")
    .single()

  for (const who of [MEMBER, MEMBER_B]) {
    const { error } = await admin.from("customers").upsert(
      {
        id: who.id,
        auth_user_id: who.authId,
        phone: who.phone,
        email: who.email,
        full_name: who.fullName,
        current_points: 600,
        lifetime_points: 600,
        lifetime_spend: 2_000_000,
        tier_id: silver?.id ?? null,
      },
      { onConflict: "id" },
    )
    if (error) throw new Error(`upsert customer ${who.phone}: ${error.message}`)
  }

  // B needs one ledger row so "A cannot see B's history" has something to fail
  // on. An absence asserted against an empty table asserts nothing.
  await admin.from("transactions").delete().eq("customer_id", MEMBER_B.id)
  const { error: txError } = await admin.from("transactions").insert({
    customer_id: MEMBER_B.id,
    phone: MEMBER_B.phone,
    type: "ADJUST",
    amount: 777,
    source: "admin",
    meta: { reason: "E2E marker for member B" },
  })
  if (txError) throw new Error(`seed B ledger: ${txError.message}`)

  // A previous run's deliberate wrong-password cases would otherwise still be
  // sitting in the counters, throttling this run's very first sign-in.
  await clearRateLimits()

  const { error: rewardError } = await admin.from("rewards").upsert(
    {
      id: TEST_REWARD.id,
      kind: "redeem",
      name: TEST_REWARD.name,
      points_cost: TEST_REWARD.pointsCost,
      quantity: 100,
      is_active: true,
      min_tier_id: null,
    },
    { onConflict: "id" },
  )
  if (rewardError) throw new Error(`upsert reward: ${rewardError.message}`)
}
