import { beforeEach, describe, expect, it, vi } from "vitest"

import { keyed } from "@/test/messages"
import { createSupabaseFake, memberUser, ok, pgFail } from "@/test/supabase"

// The wheel is drawn INSIDE the spin_wheel RPC. The browser sends nothing but
// the click: the session proves whose balance moves, the RPC picks the prize
// under a row lock and enforces the daily limit, and the animation merely spins
// to the answer it was already given.
//
// `loadSpinBoard` is a second public POST endpoint feeding the same modal, so it
// proves the session itself rather than trusting the dialog that called it.

const server = createSupabaseFake()
const admin = createSupabaseFake()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/i18n/server", () => ({
  getLocale: async () => "vi",
  getMessages: async () => ({
    customer: { errors: keyed(), spin: keyed() },
  }),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => server.client }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.client }))
vi.mock("@/lib/loyalty", () => ({
  getCustomerByAuthUserId: vi.fn(),
  getSpinDailyLimit: vi.fn(),
  getSpinPrizes: vi.fn(),
  getSpinsUsedToday: vi.fn(),
  getSpinHistory: vi.fn(),
}))

const { revalidatePath } = await import("next/cache")
const loyalty = await import("@/lib/loyalty")
const { spin, loadSpinBoard } = await import("./actions")

const lookup = vi.mocked(loyalty.getCustomerByAuthUserId)
const dailyLimit = vi.mocked(loyalty.getSpinDailyLimit)
const prizes = vi.mocked(loyalty.getSpinPrizes)
const usedToday = vi.mocked(loyalty.getSpinsUsedToday)
const history = vi.mocked(loyalty.getSpinHistory)

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111"

const prize = (over: Record<string, unknown> = {}) =>
  ({
    id: "p-1",
    name: "1.000 điểm",
    prize_type: "points",
    // Everything below is shop-side bookkeeping the browser must never see.
    quantity: 7,
    weight: 25,
    points_amount: 1000,
    is_active: true,
    ...over,
  }) as never

beforeEach(() => {
  server.reset()
  admin.reset()
  vi.mocked(revalidatePath).mockClear()
  server.user = memberUser({ id: "auth-1" })

  lookup.mockReset()
  lookup.mockResolvedValue({ id: CUSTOMER_ID } as never)
  dailyLimit.mockReset()
  dailyLimit.mockResolvedValue(3)
  prizes.mockReset()
  prizes.mockResolvedValue([prize()])
  usedToday.mockReset()
  usedToday.mockResolvedValue(1)
  history.mockReset()
  history.mockResolvedValue([])

  admin.rpcReplies.set("spin_wheel", ok({ prize_name: "1.000 điểm" }))
})

describe("spin", () => {
  it("refuses without a session and never calls the RPC", async () => {
    server.user = null
    expect(await spin()).toMatchObject({ ok: false, code: "session_expired" })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("refuses an auth user with no customers row", async () => {
    lookup.mockResolvedValue(null)
    expect(await spin()).toMatchObject({ ok: false, code: "no_customer" })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("names the spinner from the session and sends nothing else", async () => {
    await spin()
    expect(admin.rpc).toHaveBeenCalledWith("spin_wheel", {
      p_customer_id: CUSTOMER_ID,
    })
  })

  // Deliberate: a pre-flight count would be a second, racier copy of the check
  // the RPC already holds a row lock for. P0002 is the authority. If someone
  // ever adds "just a quick check first", this fails.
  it("does not count today's spins before calling", async () => {
    await spin()
    expect(dailyLimit).not.toHaveBeenCalled()
    expect(usedToday).not.toHaveBeenCalled()
  })

  it.each([
    ["P0002", "no_spins_left"],
    ["P0004", "unavailable"],
    ["P0005", "unavailable"],
    ["XX000", "spin_failed"],
  ])("maps %s to %s", async (pg, code) => {
    admin.rpcReplies.set("spin_wheel", pgFail(pg))
    expect(await spin()).toMatchObject({ ok: false, code })
  })

  // "nothing left to draw" and "the admin switched the wheel off" are different
  // shop-side facts that read identically to a member, on purpose.
  it("cannot distinguish an empty wheel from a disabled one", async () => {
    admin.rpcReplies.set("spin_wheel", pgFail("P0004"))
    const empty = await spin()
    admin.rpcReplies.set("spin_wheel", pgFail("P0005"))
    const disabled = await spin()
    expect(empty).toEqual(disabled)
  })

  // The wheel deliberately is NOT revalidated: the modal re-reads the board via
  // loadSpinBoard once the animation has stopped, so refreshing here would drop
  // a just-sold-out wedge out from under the turn in progress.
  it("busts the dashboard and the ledger only", async () => {
    await spin()
    expect(vi.mocked(revalidatePath).mock.calls.map(([p]) => p)).toEqual([
      "/dashboard",
      "/history",
    ])
  })

  it("revalidates nothing when the draw was refused", async () => {
    admin.rpcReplies.set("spin_wheel", pgFail("P0002"))
    await spin()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe("loadSpinBoard", () => {
  it("proves the session itself rather than trusting the caller", async () => {
    server.user = null
    expect(await loadSpinBoard()).toMatchObject({ ok: false, reason: "auth" })
    expect(prizes).not.toHaveBeenCalled()
    expect(dailyLimit).not.toHaveBeenCalled()
  })

  it("treats a missing customers row as an auth problem too", async () => {
    lookup.mockResolvedValue(null)
    expect(await loadSpinBoard()).toMatchObject({ ok: false, reason: "auth" })
    expect(prizes).not.toHaveBeenCalled()
  })

  // Both states are exactly what spin_wheel would answer P0005/P0004 to, so
  // rendering a spin button here would only produce an error on first click.
  it.each([
    ["the daily limit is zero", 0, [prize()]],
    ["there is nothing left to draw", 3, []],
  ])("reports the wheel as off when %s", async (_why, limit, list) => {
    dailyLimit.mockResolvedValue(limit)
    prizes.mockResolvedValue(list as never)
    expect(await loadSpinBoard()).toMatchObject({ ok: false, reason: "off" })
  })

  it("does not read the member's history once the wheel is off", async () => {
    dailyLimit.mockResolvedValue(0)
    await loadSpinBoard()
    expect(usedToday).not.toHaveBeenCalled()
    expect(history).not.toHaveBeenCalled()
  })

  it("reports the spins left for today", async () => {
    dailyLimit.mockResolvedValue(3)
    usedToday.mockResolvedValue(1)
    expect(await loadSpinBoard()).toMatchObject({ ok: true, spinsLeft: 2 })
  })

  // An admin lowering the limit mid-day can leave `used` above it. A negative
  // count would render as "-1 lượt còn lại".
  it("clamps spins left at zero when the limit was lowered mid-day", async () => {
    dailyLimit.mockResolvedValue(1)
    usedToday.mockResolvedValue(4)
    expect(await loadSpinBoard()).toMatchObject({ ok: true, spinsLeft: 0 })
  })

  // Shipping a whole RewardRow would hand the browser the stock and the weight
  // of every wedge — the odds of the wheel, for free.
  it("sends only what the wheel draws, never stock or weight", async () => {
    prizes.mockResolvedValue([prize({ id: "p-9", quantity: 2, weight: 75 })])
    const board = await loadSpinBoard()

    expect(board).toMatchObject({ ok: true })
    if (!board.ok) return
    expect(board.slices).toEqual([
      { id: "p-9", name: "1.000 điểm", prize_type: "points" },
    ])
    expect(JSON.stringify(board.slices)).not.toContain("weight")
    expect(JSON.stringify(board.slices)).not.toContain("quantity")
  })

  // Only a `gift` is settled by hand at the counter, so `fulfilled_at` is the
  // one thing telling a member a prize is still waiting for them.
  it("marks a win collected from fulfilled_at, not from its type", async () => {
    history.mockResolvedValue([
      {
        id: "w-1",
        prize_name: "Túi cát",
        prize_type: "gift",
        points_awarded: 0,
        created_at: "2026-08-30T10:00:00Z",
        fulfilled_at: null,
      },
      {
        id: "w-2",
        prize_name: "Túi cát",
        prize_type: "gift",
        points_awarded: 0,
        created_at: "2026-08-29T10:00:00Z",
        fulfilled_at: "2026-08-29T12:00:00Z",
      },
    ] as never)

    const board = await loadSpinBoard()
    expect(board).toMatchObject({ ok: true })
    if (!board.ok) return
    expect(board.history.map((w) => w.collected)).toEqual([false, true])
  })

  // The client has no locale of its own — the modal renders the string as given.
  it("formats the win date on the server", async () => {
    history.mockResolvedValue([
      {
        id: "w-1",
        prize_name: "1.000 điểm",
        prize_type: "points",
        points_awarded: 1000,
        created_at: "2026-08-30T10:00:00Z",
        fulfilled_at: null,
      },
    ] as never)

    const board = await loadSpinBoard()
    expect(board).toMatchObject({ ok: true })
    if (!board.ok) return
    expect(board.history[0]?.wonAt).toEqual(expect.any(String))
    expect(board.history[0]?.wonAt).not.toBe("2026-08-30T10:00:00Z")
  })
})
