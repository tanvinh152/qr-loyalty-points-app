import { beforeEach, describe, expect, it, vi } from "vitest"

import { PancakeRequestError } from "@/lib/pancake/types"

// Same reasoning as the webhook's own test file: this route's whole job is
// deciding, per due row, whether Pancake's total moved and whether to retry —
// so every branch is provoked with everything it touches mocked out.

const getOrder = vi.fn()
const rpc = vi.fn()
const verifyCronRequest = vi.fn()
const selectRows = vi.fn()
const update = vi.fn()

vi.mock("@/lib/pancake/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/pancake/client")>(
      "@/lib/pancake/client",
    )
  return { ...actual, getOrder: (...args: unknown[]) => getOrder(...args) }
})

vi.mock("@/lib/webhook-auth", () => ({
  verifyCronRequest: () => verifyCronRequest(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => rpc(...args),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          lte: () => selectRows(table),
        }),
      }),
      update: (patch: unknown) => ({
        eq: (column: string, value: unknown) =>
          update(table, patch, column, value),
      }),
    }),
  }),
}))

const { GET } = await import("./route")

const ROW = {
  id: "recon-1",
  order_code: "ORDER-1",
  customer_id: "cust-1",
  source_name: "TikTok Shop",
  claimed_total: 500_000,
  claimed_at: "2026-07-01T00:00:00Z",
  reconcile_after: "2026-07-07T00:00:00Z",
  status: "pending" as const,
  reconciled_at: null,
  created_at: "2026-07-01T00:00:00Z",
}

function get() {
  return GET(new Request("https://example.test/api/cron/reconcile-tiktok-orders"))
}

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})

  verifyCronRequest.mockReturnValue(true)
  selectRows.mockResolvedValue({ data: [ROW], error: null })
  update.mockResolvedValue({ error: null })
  // Different from ROW.claimed_total (500_000) so the default fixture exercises
  // the "total changed" path; the unchanged-total test overrides it back.
  getOrder.mockResolvedValue({ id: "ORDER-1", total_price: 550_000 })
  rpc.mockResolvedValue({
    data: {
      order_code: "ORDER-1",
      old_total: 500_000,
      new_total: 550_000,
      delta: 50_000,
      lifetime_spend: 550_000,
      tier_upgraded: false,
    },
    error: null,
  })
})

describe("GET /api/cron/reconcile-tiktok-orders — auth", () => {
  it("rejects a request with a bad secret", async () => {
    verifyCronRequest.mockReturnValue(false)
    const res = await get()
    expect(res.status).toBe(401)
    expect(selectRows).not.toHaveBeenCalled()
  })
})

describe("GET /api/cron/reconcile-tiktok-orders — outcomes", () => {
  it("reconciles a row whose total changed", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith("reconcile_order_spend", {
      p_order_code: "ORDER-1",
      p_new_total: 550_000, // the mocked order's total_price
    })
    expect(update).toHaveBeenCalledWith(
      "pending_order_reconciliations",
      expect.objectContaining({ status: "reconciled" }),
      "id",
      "recon-1",
    )
    expect(await json(res)).toMatchObject({ due: 1, reconciled: 1 })
  })

  it("marks unchanged without calling the RPC when the total is the same", async () => {
    getOrder.mockResolvedValueOnce({ id: "ORDER-1", total_price: 500_000 })
    const res = await get()
    expect(rpc).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      "pending_order_reconciliations",
      expect.objectContaining({ status: "unchanged" }),
      "id",
      "recon-1",
    )
    expect(await json(res)).toMatchObject({ due: 1, unchanged: 1 })
  })

  it("marks a deleted/merged order as failed and stops retrying it", async () => {
    getOrder.mockRejectedValueOnce(new PancakeRequestError("not_found"))
    const res = await get()
    expect(update).toHaveBeenCalledWith(
      "pending_order_reconciliations",
      expect.objectContaining({ status: "failed" }),
      "id",
      "recon-1",
    )
    expect(await json(res)).toMatchObject({ due: 1, failed: 1 })
  })

  it("leaves a transiently-unreachable row pending for the next tick", async () => {
    getOrder.mockRejectedValueOnce(new PancakeRequestError("unavailable"))
    const res = await get()
    expect(update).not.toHaveBeenCalled()
    expect(await json(res)).toMatchObject({ due: 1, skipped: 1 })
  })

  it("leaves the row pending when the RPC itself errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } })
    const res = await get()
    expect(update).not.toHaveBeenCalled()
    expect(await json(res)).toMatchObject({ due: 1, skipped: 1 })
  })

  it("does nothing when no rows are due", async () => {
    selectRows.mockResolvedValueOnce({ data: [], error: null })
    const res = await get()
    expect(getOrder).not.toHaveBeenCalled()
    expect(await json(res)).toMatchObject({ due: 0 })
  })
})
