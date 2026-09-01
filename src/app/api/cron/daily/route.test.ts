import { beforeEach, describe, expect, it, vi } from "vitest"

import { PancakeRequestError } from "@/lib/pancake/types"

// Two things are covered here, and they are different in kind:
//
//  1. The ORCHESTRATOR — that one failing job cannot cancel the others, that a
//     failed run still reports a non-2xx, and that `?only=` narrows the run.
//     This is the whole reason the per-job routes were merged, so it is the
//     part that must not regress.
//  2. The RECONCILIATION job itself — its whole job is deciding, per due row,
//     whether Pancake's total moved and whether to retry, so every branch is
//     provoked with everything it touches mocked out. These run with
//     `?only=reconcile-tiktok` to keep the assertions about one job.

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

const RECONCILE_RESULT = {
  order_code: "ORDER-1",
  old_total: 500_000,
  new_total: 550_000,
  delta: 50_000,
  lifetime_spend: 550_000,
  tier_upgraded: false,
}

function get(query = "") {
  return GET(new Request(`https://example.test/api/cron/daily${query}`))
}

/** Just the reconciliation job, the way the focused tests below run it. */
function getReconcile() {
  return get("?only=reconcile-tiktok")
}

async function json(res: Response) {
  return (await res.json()) as { jobs: Record<string, Record<string, unknown>> }
}

/** The one job's slice of the run summary. */
async function jobResult(res: Response, name: string) {
  return (await json(res)).jobs[name]
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
  // Both jobs reach for rpc(), so the mock answers by function name rather than
  // returning one shape to whoever asks first.
  rpc.mockImplementation((fn: string) =>
    fn === "apply_due_tier_schedules"
      ? Promise.resolve({ data: { applied: [] }, error: null })
      : Promise.resolve({ data: RECONCILE_RESULT, error: null }),
  )
})

describe("GET /api/cron/daily — auth", () => {
  it("rejects a request with a bad secret", async () => {
    verifyCronRequest.mockReturnValue(false)
    const res = await get()
    expect(res.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
    expect(selectRows).not.toHaveBeenCalled()
  })
})

describe("GET /api/cron/daily — orchestration", () => {
  it("runs every job by default", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const { jobs } = await json(res)
    expect(Object.keys(jobs)).toEqual(["tier-schedules", "reconcile-tiktok"])
    expect(jobs["tier-schedules"]).toMatchObject({ ok: true })
    expect(jobs["reconcile-tiktok"]).toMatchObject({ ok: true, reconciled: 1 })
  })

  it("runs the later jobs even when an earlier one fails", async () => {
    // tier-schedules runs first; breaking it must not cost us the reconciliation.
    rpc.mockImplementation((fn: string) =>
      fn === "apply_due_tier_schedules"
        ? Promise.resolve({ data: null, error: { code: "XX000" } })
        : Promise.resolve({ data: RECONCILE_RESULT, error: null }),
    )

    const res = await get()
    const { jobs } = await json(res)
    expect(jobs["tier-schedules"]).toMatchObject({ ok: false })
    expect(jobs["reconcile-tiktok"]).toMatchObject({ ok: true, reconciled: 1 })
  })

  it("reports a failed run as non-2xx so the cron dashboard shows it", async () => {
    rpc.mockImplementation((fn: string) =>
      fn === "apply_due_tier_schedules"
        ? Promise.resolve({ data: null, error: { code: "XX000" } })
        : Promise.resolve({ data: RECONCILE_RESULT, error: null }),
    )
    expect((await get()).status).toBe(500)
  })

  it("runs only the named job when ?only= is given", async () => {
    const res = await get("?only=tier-schedules")
    expect(Object.keys((await json(res)).jobs)).toEqual(["tier-schedules"])
    expect(selectRows).not.toHaveBeenCalled()
  })

  it("refuses an unknown ?only= rather than silently running everything", async () => {
    const res = await get("?only=nope")
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe("cron daily — reconcile-tiktok outcomes", () => {
  it("reconciles a row whose total changed", async () => {
    const res = await getReconcile()
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
    expect(await jobResult(res, "reconcile-tiktok")).toMatchObject({
      due: 1,
      reconciled: 1,
    })
  })

  it("marks unchanged without calling the RPC when the total is the same", async () => {
    getOrder.mockResolvedValueOnce({ id: "ORDER-1", total_price: 500_000 })
    const res = await getReconcile()
    expect(rpc).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      "pending_order_reconciliations",
      expect.objectContaining({ status: "unchanged" }),
      "id",
      "recon-1",
    )
    expect(await jobResult(res, "reconcile-tiktok")).toMatchObject({
      due: 1,
      unchanged: 1,
    })
  })

  it("marks a deleted/merged order as failed and stops retrying it", async () => {
    getOrder.mockRejectedValueOnce(new PancakeRequestError("not_found"))
    const res = await getReconcile()
    expect(update).toHaveBeenCalledWith(
      "pending_order_reconciliations",
      expect.objectContaining({ status: "failed" }),
      "id",
      "recon-1",
    )
    expect(await jobResult(res, "reconcile-tiktok")).toMatchObject({
      due: 1,
      failed: 1,
    })
  })

  it("leaves a transiently-unreachable row pending for the next tick", async () => {
    getOrder.mockRejectedValueOnce(new PancakeRequestError("unavailable"))
    const res = await getReconcile()
    expect(update).not.toHaveBeenCalled()
    expect(await jobResult(res, "reconcile-tiktok")).toMatchObject({
      due: 1,
      skipped: 1,
    })
  })

  it("leaves the row pending when the RPC itself errors", async () => {
    rpc.mockImplementation(() =>
      Promise.resolve({ data: null, error: { code: "XX000" } }),
    )
    const res = await getReconcile()
    expect(update).not.toHaveBeenCalled()
    expect(await jobResult(res, "reconcile-tiktok")).toMatchObject({
      due: 1,
      skipped: 1,
    })
  })

  it("does nothing when no rows are due", async () => {
    selectRows.mockResolvedValueOnce({ data: [], error: null })
    const res = await getReconcile()
    expect(getOrder).not.toHaveBeenCalled()
    expect(await jobResult(res, "reconcile-tiktok")).toMatchObject({ due: 0 })
  })
})
