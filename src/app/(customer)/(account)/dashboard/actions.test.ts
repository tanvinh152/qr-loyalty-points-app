import { beforeEach, describe, expect, it, vi } from "vitest"

import { keyed } from "@/test/messages"
import { createSupabaseFake, memberUser, ok, pgFail } from "@/test/supabase"

// Check-in is an earning path that owes nothing to Pancake: one click, points
// credited. The client sends NOTHING — not a customer id, not a date. The
// session names the member and the RPC picks the VN calendar day, so a replayed
// POST cannot award twice.

const server = createSupabaseFake()
const admin = createSupabaseFake()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/i18n/server", () => ({
  getMessages: async () => ({ customer: { errors: keyed() } }),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => server.client }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.client }))
vi.mock("@/lib/loyalty", () => ({ getCustomerByAuthUserId: vi.fn() }))

const { revalidatePath } = await import("next/cache")
const { getCustomerByAuthUserId } = await import("@/lib/loyalty")
const { checkIn } = await import("./actions")

const lookup = vi.mocked(getCustomerByAuthUserId)
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  server.reset()
  admin.reset()
  vi.mocked(revalidatePath).mockClear()
  server.user = memberUser({ id: "auth-1" })
  lookup.mockReset()
  lookup.mockResolvedValue({ id: CUSTOMER_ID } as never)
  admin.rpcReplies.set("checkin", ok({ points_awarded: 10, current_points: 110 }))
})

describe("the session is the only input", () => {
  it("refuses without a session and never calls the RPC", async () => {
    server.user = null
    expect(await checkIn()).toMatchObject({
      ok: false,
      code: "session_expired",
    })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("refuses an auth user with no customers row", async () => {
    lookup.mockResolvedValue(null)
    expect(await checkIn()).toMatchObject({ ok: false, code: "no_customer" })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("calls checkin with the session's customer and nothing else", async () => {
    await checkIn()
    expect(admin.rpc).toHaveBeenCalledWith("checkin", {
      p_customer_id: CUSTOMER_ID,
    })
  })

  // Balance and ledger must not be able to diverge, which holds only while the
  // RPC is the sole write path.
  it("never writes to customers or transactions itself", async () => {
    await checkIn()
    expect(admin.queries).toHaveLength(0)
    expect(server.queries).toHaveLength(0)
  })
})

describe("a replayed click", () => {
  // The unique index is the authority. The action's job is to turn its error
  // into a calm "already done today", never a second award and never a 500.
  it("answers a same-day repeat with already_checked_in", async () => {
    admin.rpcReplies.set("checkin", pgFail("P0002"))
    expect(await checkIn()).toMatchObject({
      ok: false,
      code: "already_checked_in",
    })
  })

  it("revalidates nothing on the repeat", async () => {
    admin.rpcReplies.set("checkin", pgFail("P0002"))
    await checkIn()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe("the failure taxonomy a member reads", () => {
  it.each([
    ["P0004", "unavailable"],
    ["P0005", "unavailable"],
    ["XX000", "checkin_failed"],
  ])("maps %s to %s", async (pg, code) => {
    admin.rpcReplies.set("checkin", pgFail(pg))
    expect(await checkIn()).toMatchObject({ ok: false, code })
  })
})

describe("the answer", () => {
  it("passes the RPC's figures through untouched", async () => {
    expect(await checkIn()).toEqual({
      ok: true,
      pointsAwarded: 10,
      currentPoints: 110,
    })
  })

  it("busts the two screens that show the streak and the ledger", async () => {
    await checkIn()
    expect(vi.mocked(revalidatePath).mock.calls.map(([p]) => p)).toEqual([
      "/dashboard",
      "/history",
    ])
  })
})
