import { beforeEach, describe, expect, it, vi } from "vitest"

import { keyed } from "@/test/messages"
import { createSupabaseFake, memberUser, ok, pgFail } from "@/test/supabase"

// The spend ladder is an independent ladder from the tiers: passing a rung
// moves no tier, credits no points and writes no ledger row — the prize is
// handed over at the counter. Claiming is the member's own action, and
// `milestone_awards_once_idx` is what makes a double-click idempotent.

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
const { claimMilestone } = await import("./actions")

const lookup = vi.mocked(getCustomerByAuthUserId)
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111"
const MILESTONE_ID = "33333333-3333-4333-8333-333333333333"

beforeEach(() => {
  server.reset()
  admin.reset()
  vi.mocked(revalidatePath).mockClear()
  server.user = memberUser({ id: "auth-1" })
  lookup.mockReset()
  lookup.mockResolvedValue({ id: CUSTOMER_ID } as never)
  admin.rpcReplies.set("claim_milestone_reward", ok({ reward_name: "Túi cát" }))
})

describe("whose award this is comes from the session", () => {
  it("refuses without a session and never calls the RPC", async () => {
    server.user = null
    expect(await claimMilestone(MILESTONE_ID)).toMatchObject({
      ok: false,
      code: "session_expired",
    })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("refuses an auth user with no customers row", async () => {
    lookup.mockResolvedValue(null)
    expect(await claimMilestone(MILESTONE_ID)).toMatchObject({
      ok: false,
      code: "no_customer",
    })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("takes the customer from the session and the rung from the argument", async () => {
    await claimMilestone(MILESTONE_ID)
    expect(admin.rpc).toHaveBeenCalledWith("claim_milestone_reward", {
      p_customer_id: CUSTOMER_ID,
      p_milestone_id: MILESTONE_ID,
    })
  })

  // Eligibility is checked inside the RPC, under a row lock. A pre-flight
  // comparison here would only be a second, racier copy of it.
  it("does not pre-check eligibility before calling", async () => {
    await claimMilestone(MILESTONE_ID)
    expect(admin.queries).toHaveLength(0)
    expect(server.queries).toHaveLength(0)
  })
})

describe("the failure taxonomy a member reads", () => {
  it.each([
    ["P0006", "locked"],
    ["P0003", "already_claimed"],
    ["P0001", "unavailable"],
    ["XX000", "claim_failed"],
  ])("maps %s to %s", async (pg, code) => {
    admin.rpcReplies.set("claim_milestone_reward", pgFail(pg))
    expect(await claimMilestone(MILESTONE_ID)).toMatchObject({ ok: false, code })
  })

  // A forged id and a rung the admin just deactivated both arrive as P0001, so
  // the answer must not let a member tell them apart.
  it("cannot distinguish a forged id from a deactivated rung", async () => {
    admin.rpcReplies.set("claim_milestone_reward", pgFail("P0001"))
    const forged = await claimMilestone("44444444-4444-4444-8444-444444444444")
    const deactivated = await claimMilestone(MILESTONE_ID)
    expect(forged).toEqual(deactivated)
  })

  // The index turns the second click into an error, not a second award.
  it("answers a double-click with already_claimed", async () => {
    admin.rpcReplies.set("claim_milestone_reward", pgFail("P0003"))
    expect(await claimMilestone(MILESTONE_ID)).toMatchObject({
      ok: false,
      code: "already_claimed",
    })
  })
})

describe("what a claim busts", () => {
  // /history is deliberately absent: the ladder credits no points, so there is
  // no ledger row for it to show.
  it("revalidates the roadmap and the dashboard, but not the ledger", async () => {
    await claimMilestone(MILESTONE_ID)
    const paths = vi.mocked(revalidatePath).mock.calls.map(([p]) => p)
    expect(paths).toEqual(["/rewards/roadmap", "/dashboard"])
    expect(paths).not.toContain("/history")
  })

  it("revalidates nothing when the claim was refused", async () => {
    admin.rpcReplies.set("claim_milestone_reward", pgFail("P0006"))
    await claimMilestone(MILESTONE_ID)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
