import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import {
  clearTransactions,
  db,
  readCustomer,
  readTransactions,
  setCustomer,
} from "./fixtures/db"
import {
  orderFixture,
  resetStub,
  stageOrder,
  stageOrderFailure,
  stageOrderMissing,
  stubWrites,
} from "./pancake-stub"
import { WEBHOOK_SECRET } from "./secrets"

/**
 * `/api/webhooks/pancake` — the only way points are earned after signup.
 *
 * The governing rule, and the reason most of these cases assert a 200: Pancake
 * retries any non-2xx. So every BUSINESS outcome ("nobody to credit", "not
 * settled yet", "already counted") must answer 200 with a `skipped` reason,
 * while only auth failures, malformed bodies and genuinely retryable faults get
 * an error status. Getting that backwards either burns points silently or
 * starts a retry storm against a bug nobody is paged for.
 *
 * Every order here is served by `e2e/pancake-stub.ts`. The route re-fetches the
 * order rather than trusting the delivery, so staging it is not a convenience —
 * it is the only way the endpoint can do anything at all.
 */

const POS_CUSTOMER = "pos-cus-webhook-1"

// Distinct from seed.sql's own values so nothing here can be confused for
// production-shaped data, and far from MEMBER_B's 777-point marker row.
const VND_PER_POINT = 1000

test.beforeEach(async () => {
  await resetStub()
  await clearTransactions(MEMBER.id)
  await db()
    .from("pending_order_reconciliations")
    .delete()
    .eq("customer_id", MEMBER.id)
  // The webhook can only attribute an order whose POS customer id already
  // matches a member — that link is what `signUp` writes and what this endpoint
  // can never create for itself, because Pancake masks phone numbers.
  await setCustomer(MEMBER.id, {
    pancake_customer_id: POS_CUSTOMER,
    current_points: 0,
    lifetime_points: 0,
    lifetime_spend: 0,
    tier_id: null,
  })
})

function deliver(
  request: import("@playwright/test").APIRequestContext,
  body: unknown,
  secret: string | null = WEBHOOK_SECRET,
) {
  return request.post("/api/webhooks/pancake", {
    headers: secret ? { "x-webhook-secret": secret } : {},
    data: body,
    failOnStatusCode: false,
  })
}

test("a delivery without the shared secret is refused", async ({ request }) => {
  const res = await deliver(request, { id: "WH-1" }, "wrong-secret")
  expect(res.status()).toBe(401)
  expect(await res.json()).toEqual({ error: "unauthorized" })
})

test("a delivery naming no order is unprocessable", async ({ request }) => {
  const res = await deliver(request, { nothing: true })
  expect(res.status()).toBe(422)
  expect(await res.json()).toEqual({ error: "missing_order_id" })
})

test("a settled order credits the member and says so without naming them", async ({
  request,
}) => {
  await stageOrder(
    "WH-OK",
    orderFixture({
      id: "WH-OK",
      total_price_after_sub_discount: 250_000,
      customer: { customer_id: POS_CUSTOMER, phone_numbers: ["0****52"] },
    }),
  )

  const res = await deliver(request, { id: "WH-OK" })
  expect(res.status()).toBe(200)

  // No tier held, so the multiplier is x1: floor(250000 / 1000) = 250.
  const expected = 250_000 / VND_PER_POINT
  expect(await res.json()).toEqual({ claimed: true, points_awarded: expected })

  const customer = await readCustomer(MEMBER.id)
  expect(customer.current_points).toBe(expected)
  expect(customer.lifetime_spend).toBe(250_000)

  const rows = await readTransactions(MEMBER.id)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    type: "EARN",
    source: "webhook",
    amount: expected,
  })
})

test("the success body carries no customer PII", async ({ request }) => {
  await stageOrder(
    "WH-PII",
    orderFixture({
      id: "WH-PII",
      customer: {
        customer_id: POS_CUSTOMER,
        phone_numbers: ["0****52"],
        name: "Nguyễn Văn PII",
      },
    }),
  )

  const res = await deliver(request, { id: "WH-PII" })
  // Pancake logs webhook bodies, so anything echoed here is logged with it.
  const body = await res.text()
  expect(body).not.toContain(MEMBER.phone)
  expect(body).not.toContain("PII")
  expect(body).not.toContain(MEMBER.email)
})

test("an order that is not settled yet earns nothing, and is not retried", async ({
  request,
}) => {
  // Status 0 is outside seed.sql's claimable_statuses {3,16}.
  await stageOrder(
    "WH-PENDING",
    orderFixture({
      id: "WH-PENDING",
      status: 0,
      customer: { customer_id: POS_CUSTOMER, phone_numbers: ["0****52"] },
    }),
  )

  const res = await deliver(request, { id: "WH-PENDING" })
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({ claimed: false, skipped: "not_eligible" })
  expect(await readTransactions(MEMBER.id)).toHaveLength(0)
})

test("an order belonging to nobody we know earns nothing, and is not retried", async ({
  request,
}) => {
  await stageOrder(
    "WH-STRANGER",
    orderFixture({
      id: "WH-STRANGER",
      customer: {
        customer_id: "pos-cus-never-registered",
        phone_numbers: ["0****11"],
      },
    }),
  )

  const res = await deliver(request, { id: "WH-STRANGER" })
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({
    claimed: false,
    skipped: "unknown_customer",
  })
  expect(await readTransactions(MEMBER.id)).toHaveLength(0)
})

test("an order Pancake has never heard of is a conclusion, not a fault", async ({
  request,
}) => {
  await stageOrderMissing("WH-GHOST")
  const res = await deliver(request, { id: "WH-GHOST" })
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({
    claimed: false,
    skipped: "order_not_found",
  })
})

test("a redelivery of an order already counted adds nothing", async ({
  request,
}) => {
  await stageOrder(
    "WH-DUP",
    orderFixture({
      id: "WH-DUP",
      total_price_after_sub_discount: 100_000,
      customer: { customer_id: POS_CUSTOMER, phone_numbers: ["0****52"] },
    }),
  )

  const first = await deliver(request, { id: "WH-DUP" })
  expect(await first.json()).toEqual({ claimed: true, points_awarded: 100 })

  const second = await deliver(request, { id: "WH-DUP" })
  expect(second.status()).toBe(200)
  expect(await second.json()).toEqual({
    claimed: false,
    skipped: "already_claimed",
  })

  // The point of the case: the balance moved exactly once.
  expect((await readCustomer(MEMBER.id)).current_points).toBe(100)
  expect(await readTransactions(MEMBER.id)).toHaveLength(1)
})

test("a POS outage is retryable, so it must not answer 200", async ({
  request,
}) => {
  await stageOrderFailure("WH-DOWN", 503)
  const res = await deliver(request, { id: "WH-DOWN" })
  expect(res.status()).toBe(503)
  expect(await res.json()).toEqual({ error: "pancake_unavailable" })
})

test("a bad API key is NOT retryable, so it answers 200 and shouts in the log", async ({
  request,
}) => {
  // The stub answers 401 to any request whose key it does not recognise; the
  // client maps that to `unauthorized`, which retrying can never fix.
  await stageOrderFailure("WH-BADKEY", 401)
  const res = await deliver(request, { id: "WH-BADKEY" })
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({
    claimed: false,
    skipped: "pancake_misconfigured",
  })
})

test("the order id may arrive under any of the shapes Pancake sends", async ({
  request,
}) => {
  for (const [label, body] of [
    ["data.id", { data: { id: "WH-SHAPE" } }],
    ["order.id", { order: { id: "WH-SHAPE" } }],
    ["system_id", { system_id: 90210 }],
  ] as const) {
    await clearTransactions(MEMBER.id)
    await resetStub()
    await stageOrder(
      "WH-SHAPE",
      orderFixture({
        id: "WH-SHAPE",
        system_id: 90210,
        total_price_after_sub_discount: 50_000,
        customer: { customer_id: POS_CUSTOMER, phone_numbers: ["0****52"] },
      }),
    )

    const res = await deliver(request, body)
    expect(await res.json(), label).toEqual({
      claimed: true,
      points_awarded: 50,
    })
  }
})

test("a TikTok order is claimed now and queued for a later re-check", async ({
  request,
}) => {
  await stageOrder(
    "WH-TIKTOK",
    orderFixture({
      id: "WH-TIKTOK",
      order_sources_name: "TikTok Shop",
      total_price_after_sub_discount: 300_000,
      customer: { customer_id: POS_CUSTOMER, phone_numbers: ["0****52"] },
    }),
  )

  const res = await deliver(request, { id: "WH-TIKTOK" })
  expect(await res.json()).toEqual({ claimed: true, points_awarded: 300 })

  // TikTok reports a total that Pancake keeps syncing after the sale, so the
  // claim is provisional: the cron re-reads it later (see api-cron.spec.ts).
  const { data } = await db()
    .from("pending_order_reconciliations")
    .select("order_code, claimed_total, reconcile_after")
    .eq("customer_id", MEMBER.id)
  expect(data).toHaveLength(1)
  expect(data![0].order_code).toBe("WH-TIKTOK")
  expect(Number(data![0].claimed_total)).toBe(300_000)
})

test.afterAll(async () => {
  // Nothing in this file may write to the POS: the webhook is a read-only
  // consumer of Pancake, and the only legitimate write in the whole app is
  // signup's name/phone write-back.
  expect(await stubWrites()).toEqual([])
})
