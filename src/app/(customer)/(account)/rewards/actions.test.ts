import { beforeEach, describe, expect, it, vi } from "vitest"

import { keyed } from "@/test/messages"
import { createSupabaseFake, memberUser, ok, pgFail } from "@/test/supabase"

// Redemption moves a real balance, so the browser is trusted with exactly one
// thing: which reward. WHOSE points get spent is resolved from the session here
// and never read off the request — a Server Action is a public POST endpoint,
// and the redeem_reward RPC is service_role-only precisely because it trusts
// what it is handed.

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
const { redeemReward } = await import("./actions")

const lookup = vi.mocked(getCustomerByAuthUserId)
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111"
const REWARD_ID = "22222222-2222-4222-8222-222222222222"

const SUCCESS = {
  reward_name: "Voucher 50.000đ",
  points_spent: 500,
  current_points: 100,
}

beforeEach(() => {
  server.reset()
  admin.reset()
  vi.mocked(revalidatePath).mockClear()
  server.user = memberUser({ id: "auth-1" })
  lookup.mockReset()
  lookup.mockResolvedValue({ id: CUSTOMER_ID } as never)
  admin.rpcReplies.set("redeem_reward", ok(SUCCESS))
})

describe("the session is what proves whose points may be spent", () => {
  it("refuses without a session and never calls the RPC", async () => {
    server.user = null
    expect(await redeemReward(REWARD_ID)).toMatchObject({
      ok: false,
      code: "session_expired",
    })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("refuses an auth user with no customers row", async () => {
    lookup.mockResolvedValue(null)
    expect(await redeemReward(REWARD_ID)).toMatchObject({
      ok: false,
      code: "no_customer",
    })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("resolves the customer from the session, not from the argument", async () => {
    await redeemReward(REWARD_ID)

    expect(lookup).toHaveBeenCalledWith("auth-1")
    expect(admin.rpc).toHaveBeenCalledWith("redeem_reward", {
      p_customer_id: CUSTOMER_ID,
      p_reward_id: REWARD_ID,
    })
  })

  // Nothing the browser sends may name a customer. If a second argument ever
  // appears, this is the test that should stop it.
  it("sends exactly two parameters and no more", async () => {
    await redeemReward(REWARD_ID)
    expect(Object.keys(admin.rpc.mock.calls[0]?.[1] as object)).toEqual([
      "p_customer_id",
      "p_reward_id",
    ])
  })
})

describe("the failure taxonomy a member reads", () => {
  it.each([
    ["P0001", "reward_not_found"],
    ["P0002", "out_of_stock"],
    ["P0003", "insufficient_points"],
    ["P0006", "tier_too_low"],
    ["XX000", "redeem_failed"],
    ["23505", "redeem_failed"],
  ])("maps %s to %s", async (pg, code) => {
    admin.rpcReplies.set("redeem_reward", pgFail(pg))
    expect(await redeemReward(REWARD_ID)).toMatchObject({ ok: false, code })
  })

  it("falls back to redeem_failed when Postgres gave no code at all", async () => {
    admin.rpcReplies.set("redeem_reward", { data: null, error: {} })
    expect(await redeemReward(REWARD_ID)).toMatchObject({
      ok: false,
      code: "redeem_failed",
    })
  })
})

describe("the answer", () => {
  // The RPC did the arithmetic under a row lock. Recomputing the balance here
  // would be a second, always-staler opinion about the member's own money.
  it("passes the RPC's figures through without touching them", async () => {
    expect(await redeemReward(REWARD_ID)).toEqual({
      ok: true,
      rewardName: "Voucher 50.000đ",
      pointsSpent: 500,
      currentPoints: 100,
    })
  })

  it("busts every screen that shows the balance", async () => {
    await redeemReward(REWARD_ID)
    expect(vi.mocked(revalidatePath).mock.calls.map(([p]) => p)).toEqual([
      "/rewards",
      "/dashboard",
      "/history",
    ])
  })

  it("revalidates nothing when the redemption was refused", async () => {
    admin.rpcReplies.set("redeem_reward", pgFail("P0003"))
    await redeemReward(REWARD_ID)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
