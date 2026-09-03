import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import {
  clearSchedules,
  clearTransactions,
  db,
  readCustomer,
  setCustomer,
  tierIdByName,
} from "./fixtures/db"
import { orderFixture, resetStub, stageOrder, stubWrites } from "./pancake-stub"
import { CRON_SECRET, WEBHOOK_SECRET } from "./secrets"

/**
 * `/api/cron/daily` — one scheduled route for every daily job, because Vercel's
 * Hobby plan caps a project at a small number of cron entries.
 *
 * Two things here are easy to break and expensive to notice:
 *  - a failing job must not cancel the ones after it, and the response must go
 *    RED (500) when one fails, or a job can sit dead for weeks behind a 200;
 *  - `tier-schedules` must raise the threshold WITHOUT touching anyone's
 *    `customers.tier_id`. That omission is the grandfathering — the whole
 *    promise that a tier you have earned is never taken back.
 */

const TIER = "Vàng"
const ORIGINAL_THRESHOLD = 2_000_000
const POS_CUSTOMER = "pos-cus-cron"

async function call(
  request: import("@playwright/test").APIRequestContext,
  path: string,
  headers: Record<string, string>,
) {
  return request.get(path, { headers, failOnStatusCode: false })
}

const withSecret = { "x-webhook-secret": WEBHOOK_SECRET }

test.beforeEach(async () => {
  await resetStub()
  await clearSchedules()
  await clearTransactions(MEMBER.id)
  await db()
    .from("pending_order_reconciliations")
    .delete()
    .eq("customer_id", MEMBER.id)
  await setCustomer(MEMBER.id, {
    pancake_customer_id: POS_CUSTOMER,
    current_points: 0,
    lifetime_points: 0,
    lifetime_spend: 0,
    tier_id: null,
  })
  await db()
    .from("membership_tiers")
    .update({ spend_threshold: ORIGINAL_THRESHOLD })
    .eq("name", TIER)
})

test.afterAll(async () => {
  await clearSchedules()
  await db()
    .from("membership_tiers")
    .update({ spend_threshold: ORIGINAL_THRESHOLD })
    .eq("name", TIER)
})

test("an unauthenticated call is refused", async ({ request }) => {
  const res = await call(request, "/api/cron/daily", {})
  expect(res.status()).toBe(401)
  expect(await res.json()).toEqual({ error: "unauthorized" })
})

test("a wrong secret is refused", async ({ request }) => {
  const res = await call(request, "/api/cron/daily", {
    "x-webhook-secret": "nope",
  })
  expect(res.status()).toBe(401)
})

test("Vercel Cron's bearer token is accepted too", async ({ request }) => {
  // Vercel sends this automatically once CRON_SECRET is a project env var; the
  // Pancake webhook itself will never send it, which is why only this route
  // accepts both shapes.
  const res = await call(request, "/api/cron/daily?only=tier-schedules", {
    authorization: `Bearer ${CRON_SECRET}`,
  })
  expect(res.status()).toBe(200)
})

test("an unknown job name is rejected, and says what it knows", async ({
  request,
}) => {
  const res = await call(request, "/api/cron/daily?only=nonsense", withSecret)
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.error).toBe("unknown_job")
  expect(body.known).toEqual(["tier-schedules", "reconcile-tiktok"])
})

test("a due threshold raise is applied, and grandfathers the members under it", async ({
  request,
}) => {
  const tierId = await tierIdByName(TIER)

  // The member holds Vàng on 2.000.000đ of spend — exactly the old bar.
  await setCustomer(MEMBER.id, {
    lifetime_spend: ORIGINAL_THRESHOLD,
    tier_id: tierId,
  })

  const { error } = await db()
    .from("tier_threshold_schedules")
    .insert({
      tier_id: tierId,
      mode: "amount",
      target_amount: 3_000_000,
      // Yesterday: due, so this tick must pick it up.
      effective_at: new Date(Date.now() - 86_400_000).toISOString(),
      note: "E2E raise",
    })
  if (error) throw new Error(`insert schedule: ${error.message}`)

  const res = await call(
    request,
    "/api/cron/daily?only=tier-schedules",
    withSecret,
  )
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.jobs["tier-schedules"].ok).toBe(true)
  expect(body.jobs["tier-schedules"].applied).toHaveLength(1)

  const { data: tier } = await db()
    .from("membership_tiers")
    .select("spend_threshold")
    .eq("id", tierId)
    .single()
  expect(Number(tier!.spend_threshold)).toBe(3_000_000)

  // THE case: the bar moved, the member did not. They now hold a tier their
  // spend would no longer buy, and that is correct.
  const customer = await readCustomer(MEMBER.id)
  expect(customer.tier_id).toBe(tierId)
  expect(Number(customer.lifetime_spend)).toBe(ORIGINAL_THRESHOLD)

  const { data: schedule } = await db()
    .from("tier_threshold_schedules")
    .select("applied_at, resolved_amount")
    .eq("tier_id", tierId)
    .single()
  expect(schedule!.applied_at).not.toBeNull()
  expect(Number(schedule!.resolved_amount)).toBe(3_000_000)
})

test("a schedule dated in the future is left alone", async ({ request }) => {
  const tierId = await tierIdByName(TIER)
  await db()
    .from("tier_threshold_schedules")
    .insert({
      tier_id: tierId,
      mode: "amount",
      target_amount: 9_000_000,
      effective_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })

  const res = await call(
    request,
    "/api/cron/daily?only=tier-schedules",
    withSecret,
  )
  expect((await res.json()).jobs["tier-schedules"].applied).toHaveLength(0)

  const { data: tier } = await db()
    .from("membership_tiers")
    .select("spend_threshold")
    .eq("id", tierId)
    .single()
  expect(Number(tier!.spend_threshold)).toBe(ORIGINAL_THRESHOLD)
})

test("applying the same due schedule twice changes nothing the second time", async ({
  request,
}) => {
  const tierId = await tierIdByName(TIER)
  await db()
    .from("tier_threshold_schedules")
    .insert({
      tier_id: tierId,
      mode: "amount",
      target_amount: 2_500_000,
      effective_at: new Date(Date.now() - 3_600_000).toISOString(),
    })

  const first = await call(
    request,
    "/api/cron/daily?only=tier-schedules",
    withSecret,
  )
  expect((await first.json()).jobs["tier-schedules"].applied).toHaveLength(1)

  // Idempotence is what lets /admin/tiers fire this on every render.
  const second = await call(
    request,
    "/api/cron/daily?only=tier-schedules",
    withSecret,
  )
  expect((await second.json()).jobs["tier-schedules"].applied).toHaveLength(0)

  const { data: tier } = await db()
    .from("membership_tiers")
    .select("spend_threshold")
    .eq("id", tierId)
    .single()
  expect(Number(tier!.spend_threshold)).toBe(2_500_000)
})

/**
 * Queues a real reconciliation by making a real TikTok claim.
 *
 * `reconcile_order_spend` re-prices the EARN row an order already has — it
 * raises P0001 when there is none. So the queue row cannot be hand-forged: the
 * ledger row, its `meta.order_total` and the queue entry all have to come from
 * the same claim. Delivering the webhook is both the cheapest way to produce
 * that state and the pairing this job exists to complete.
 */
async function claimTikTokOrder(
  request: import("@playwright/test").APIRequestContext,
  orderCode: string,
  claimedTotal: number,
) {
  await stageOrder(
    orderCode,
    orderFixture({
      id: orderCode,
      order_sources_name: "TikTok Shop",
      total_price_after_sub_discount: claimedTotal,
      customer: { customer_id: POS_CUSTOMER, phone_numbers: ["0****52"] },
    }),
  )

  const res = await request.post("/api/webhooks/pancake", {
    headers: withSecret,
    data: { id: orderCode },
  })
  expect(await res.json()).toMatchObject({ claimed: true })

  // The webhook books the re-check six days out; a spec cannot wait that long.
  const { error } = await db()
    .from("pending_order_reconciliations")
    .update({
      reconcile_after: new Date(Date.now() - 86_400_000).toISOString(),
    })
    .eq("order_code", orderCode)
  if (error) throw new Error(`backdate ${orderCode}: ${error.message}`)
}

test("a queued TikTok order whose total moved corrects the member's spend", async ({
  request,
}) => {
  await claimTikTokOrder(request, "CRON-TT-1", 300_000)
  const claimed = await readCustomer(MEMBER.id)
  expect(Number(claimed.lifetime_spend)).toBe(300_000)

  // Pancake's synced total has since risen — the case the whole job exists for.
  await stageOrder(
    "CRON-TT-1",
    orderFixture({
      id: "CRON-TT-1",
      order_sources_name: "TikTok Shop",
      total_price_after_sub_discount: 500_000,
      customer: { customer_id: POS_CUSTOMER, phone_numbers: ["0****52"] },
    }),
  )

  const res = await call(
    request,
    "/api/cron/daily?only=reconcile-tiktok",
    withSecret,
  )
  expect(res.status()).toBe(200)
  expect((await res.json()).jobs["reconcile-tiktok"]).toMatchObject({
    ok: true,
    due: 1,
    reconciled: 1,
  })

  // Spend is corrected by the DIFFERENCE, and points are deliberately NOT
  // re-issued: this job moves money, never currency.
  const after = await readCustomer(MEMBER.id)
  expect(Number(after.lifetime_spend)).toBe(500_000)
  expect(after.current_points).toBe(claimed.current_points)

  const { data } = await db()
    .from("pending_order_reconciliations")
    .select("status")
    .eq("order_code", "CRON-TT-1")
    .single()
  expect(data!.status).toBe("reconciled")
})

test("a queued order whose total did not move is closed as unchanged", async ({
  request,
}) => {
  await claimTikTokOrder(request, "CRON-TT-2", 300_000)

  const res = await call(
    request,
    "/api/cron/daily?only=reconcile-tiktok",
    withSecret,
  )
  expect((await res.json()).jobs["reconcile-tiktok"]).toMatchObject({
    due: 1,
    unchanged: 1,
    reconciled: 0,
  })
  expect(Number((await readCustomer(MEMBER.id)).lifetime_spend)).toBe(300_000)
})

test("with no argument every job runs", async ({ request }) => {
  await db()
    .from("pending_order_reconciliations")
    .delete()
    .eq("customer_id", MEMBER.id)
  const res = await call(request, "/api/cron/daily", withSecret)
  expect(res.status()).toBe(200)
  const jobs = (await res.json()).jobs
  expect(Object.keys(jobs).sort()).toEqual([
    "reconcile-tiktok",
    "tier-schedules",
  ])
})

test.afterAll(async () => {
  // The reconciliation job READS orders from the POS and must never write.
  expect(await stubWrites()).toEqual([])
})
