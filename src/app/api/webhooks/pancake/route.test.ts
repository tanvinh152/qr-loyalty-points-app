import { beforeEach, describe, expect, it, vi } from "vitest"

import { PancakeRequestError } from "@/lib/pancake/types"

// The handler's whole job is turning outcomes into HTTP status codes, and the
// codes are load-bearing: Pancake retries a non-2xx and never retries a 2xx.
// Get one wrong and points are either dropped for good or replayed forever.
// Everything the handler touches is mocked so each outcome can be provoked.

const getOrder = vi.fn()
const getActiveSettings = vi.fn()
const isOrderClaimed = vi.fn()
const getCustomerByPancakeId = vi.fn()
const rpc = vi.fn()
const verifyWebhookSecret = vi.fn()
const reconciliationInsert = vi.fn()

vi.mock("@/lib/pancake/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/pancake/client")>(
      "@/lib/pancake/client",
    )
  return { ...actual, getOrder: (...args: unknown[]) => getOrder(...args) }
})

vi.mock("@/lib/loyalty", () => ({
  getActiveSettings: () => getActiveSettings(),
  isOrderClaimed: (code: string) => isOrderClaimed(code),
  getCustomerByPancakeId: (id: string) => getCustomerByPancakeId(id),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => rpc(...args),
    from: (table: string) => ({
      insert: (row: unknown) => reconciliationInsert(table, row),
    }),
  }),
}))

vi.mock("@/lib/webhook-auth", () => ({
  WEBHOOK_SECRET_HEADER: "x-webhook-secret",
  verifyWebhookSecret: () => verifyWebhookSecret(),
}))

const { POST } = await import("./route")

const ORDER = {
  id: "ORDER-1",
  system_id: 1,
  status: 3,
  items: [{ quantity: 1, variation_info: { display_id: "SKU-1" } }],
  total_price: 500_000,
  customer: { customer_id: "pos-1", phone_numbers: ["0****70"] },
}

const CUSTOMER = {
  id: "cust-1",
  phone: "0901234570",
  full_name: "Nguyễn Văn A",
  email: null,
}

function post(body: unknown = { id: "ORDER-1" }) {
  return POST(
    new Request("https://example.test/api/webhooks/pancake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})

  verifyWebhookSecret.mockReturnValue(true)
  getOrder.mockResolvedValue(ORDER)
  getActiveSettings.mockResolvedValue({
    rounding: "floor",
    unmapped_sku_points: 0,
    claimable_statuses: [3, 16],
  })
  isOrderClaimed.mockResolvedValue(false)
  getCustomerByPancakeId.mockResolvedValue(CUSTOMER)
  rpc.mockResolvedValue({ data: { points_awarded: 10 }, error: null })
  reconciliationInsert.mockResolvedValue({ error: null })
})

describe("POST /api/webhooks/pancake — the happy path", () => {
  it("claims the order and reports the points without leaking PII", async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ claimed: true, points_awarded: 10 })

    // The payload is only a pointer; the order is re-read from the API.
    expect(getOrder).toHaveBeenCalledWith("ORDER-1")
    expect(rpc).toHaveBeenCalledWith(
      "claim_points",
      expect.objectContaining({
        p_order_code: "ORDER-1",
        p_source: "webhook",
        p_pancake_customer_id: "pos-1",
      }),
    )
  })
})

describe("POST /api/webhooks/pancake — authentication and payload", () => {
  it("rejects a request with a bad secret", async () => {
    verifyWebhookSecret.mockReturnValue(false)
    const res = await post()
    expect(res.status).toBe(401)
    expect(getOrder).not.toHaveBeenCalled()
  })

  it("refuses a body carrying no order identifier", async () => {
    const res = await post({ event: "order.updated" })
    expect(res.status).toBe(422)
  })
})

// Pancake failures. The dividing line is whether retrying the SAME delivery
// could ever succeed.
describe("POST /api/webhooks/pancake — Pancake errors", () => {
  it("stops retrying a misconfiguration instead of storming", async () => {
    // A bad API key answers identically on every redelivery, so a 503 here is
    // an infinite retry loop against a bug nobody is paged about.
    for (const kind of ["unauthorized", "malformed"] as const) {
      getOrder.mockRejectedValueOnce(new PancakeRequestError(kind))
      const res = await post()
      expect(res.status, kind).toBe(200)
      expect(await json(res)).toMatchObject({
        skipped: "pancake_misconfigured",
      })
    }
  })

  it("asks for a retry when Pancake is merely unreachable", async () => {
    getOrder.mockRejectedValueOnce(new PancakeRequestError("unavailable"))
    const res = await post()
    expect(res.status).toBe(503)
  })

  it("accepts an order Pancake does not know as a settled outcome", async () => {
    getOrder.mockRejectedValueOnce(new PancakeRequestError("not_found"))
    const res = await post()
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ skipped: "order_not_found" })
  })
})

// The regression this file exists for: these lookups used to swallow their
// errors, so a database blip answered "no such customer" — a 200 — and the
// points were gone permanently.
describe("POST /api/webhooks/pancake — database faults are retryable", () => {
  it("returns 503 when the claimed-already check fails", async () => {
    isOrderClaimed.mockRejectedValueOnce(new Error("connection reset"))
    const res = await post()
    expect(res.status).toBe(503)
    expect(await json(res)).toMatchObject({ error: "db_unavailable" })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("returns 503 — not 200 unknown_customer — when the lookup fails", async () => {
    getCustomerByPancakeId.mockRejectedValueOnce(new Error("connection reset"))
    const res = await post()
    expect(res.status).toBe(503)
    expect(await json(res)).toMatchObject({ error: "db_unavailable" })
  })

  it("still answers 200 when the customer genuinely is not linked", async () => {
    getCustomerByPancakeId.mockResolvedValueOnce(null)
    const res = await post()
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ skipped: "unknown_customer" })
  })

  it("answers 200 when the order carries no POS customer at all", async () => {
    getOrder.mockResolvedValueOnce({ ...ORDER, customer: undefined })
    const res = await post()
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ skipped: "unknown_customer" })
    expect(getCustomerByPancakeId).not.toHaveBeenCalled()
  })
})

describe("POST /api/webhooks/pancake — claim outcomes", () => {
  it("skips an order whose status is not claimable", async () => {
    getOrder.mockResolvedValueOnce({ ...ORDER, status: 0 })
    const res = await post()
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ skipped: "not_eligible" })
  })

  it("treats a duplicate delivery as settled, not as a failure", async () => {
    isOrderClaimed.mockResolvedValueOnce(true)
    const res = await post()
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ skipped: "already_claimed" })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("treats losing the race to the unique index the same way", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002" } })
    const res = await post()
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ skipped: "already_claimed" })
  })

  it("asks for a retry when the claim itself errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } })
    const res = await post()
    expect(res.status).toBe(500)
  })

  it("returns 503 when no loyalty settings are active", async () => {
    getActiveSettings.mockResolvedValueOnce(null)
    const res = await post()
    expect(res.status).toBe(503)
  })
})

// 0016: TikTok orders sync their final total 4-6 days late, so a claimed
// order from that channel is queued for a later re-check.
describe("POST /api/webhooks/pancake — TikTok reconciliation queue", () => {
  it("enqueues a claimed TikTok order", async () => {
    getOrder.mockResolvedValueOnce({
      ...ORDER,
      order_sources_name: "TikTok Shop",
    })
    const res = await post()
    expect(res.status).toBe(200)
    expect(reconciliationInsert).toHaveBeenCalledWith(
      "pending_order_reconciliations",
      expect.objectContaining({
        order_code: "ORDER-1",
        customer_id: "cust-1",
        source_name: "TikTok Shop",
        claimed_total: 500_000,
      }),
    )
  })

  it("does not enqueue an order from another channel", async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(reconciliationInsert).not.toHaveBeenCalled()
  })

  it("still reports the claim as successful when the enqueue write fails", async () => {
    getOrder.mockResolvedValueOnce({
      ...ORDER,
      order_sources_name: "TikTok Shop",
    })
    reconciliationInsert.mockResolvedValueOnce({ error: new Error("boom") })
    const res = await post()
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ claimed: true, points_awarded: 10 })
  })
})
