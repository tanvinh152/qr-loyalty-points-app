import { beforeEach, describe, expect, it, vi } from "vitest"

import { keyed } from "@/test/messages"
import {
  adminUser,
  createSupabaseFake,
  memberUser,
  pgFail,
} from "@/test/supabase"

// adjustPoints is the manual grant path: it moves a real balance and can hand
// out a tier. It reaches for the SERVICE-ROLE client, which bypasses RLS
// entirely, so the only thing standing in front of it is the claim check inside
// the action itself. A Server Action is a public POST endpoint — the /admin
// guard in the proxy never sees a direct call.

const server = createSupabaseFake()
const admin = createSupabaseFake()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/i18n/server", () => ({
  getMessages: async () => ({
    validation: keyed(),
    admin: { customers: { detail: { adjust: keyed() } } },
  }),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => server.client }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.client }))

const { revalidatePath } = await import("next/cache")
const { adjustPoints } = await import("./actions")

const CUSTOMER = "3f2504e0-4f89-41d3-9a0c-0305e82c3301"
const TIER = "9c858901-8a57-4791-81fe-4c455b099bc9"

const input = (over: Record<string, unknown> = {}) => ({
  customer_id: CUSTOMER,
  current_delta: 50,
  lifetime_delta: 0,
  grant_tier_id: "",
  reason: "Bù điểm đơn lỗi",
  ...over,
}) as never

beforeEach(() => {
  server.reset()
  admin.reset()
  vi.mocked(revalidatePath).mockClear()
  vi.spyOn(console, "error").mockImplementation(() => {})
  server.user = adminUser({ id: "staff-1", email: "staff@shop.test" })
})

describe("authorization", () => {
  it("refuses an anonymous caller without touching the service-role client", async () => {
    server.user = null
    expect(await adjustPoints(input())).toEqual({
      ok: false,
      message: "forbidden",
    })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("refuses a signed-in member who carries no admin claim", async () => {
    server.user = memberUser()
    expect(await adjustPoints(input())).toEqual({
      ok: false,
      message: "forbidden",
    })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  // app_metadata is service-role writable only; user_metadata is not. Reading
  // the role from the wrong bag would let any member grant themselves points.
  it("does not accept a role planted in user_metadata", async () => {
    server.user = memberUser({ user_metadata: { role: "admin" } })
    expect(await adjustPoints(input())).toEqual({
      ok: false,
      message: "forbidden",
    })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  // The invalid-payload branch returns before the claim is read. That is fine
  // ONLY because it answers with a validation message either way — it must not
  // become an oracle for "am I talking to an admin?".
  it("rejects a malformed payload without reaching either client", async () => {
    server.user = null
    const res = await adjustPoints(input({ reason: "   " }))
    expect(res?.ok).toBe(false)
    expect(admin.rpc).not.toHaveBeenCalled()
    expect(server.queries).toHaveLength(0)
    expect(admin.queries).toHaveLength(0)
  })
})

describe("what reaches the RPC", () => {
  it("stamps the actor from the session, never from the payload", async () => {
    await adjustPoints(input({ p_actor: { id: "someone-else" } }))

    expect(admin.rpc).toHaveBeenCalledWith("adjust_points", {
      p_customer_id: CUSTOMER,
      p_current_delta: 50,
      p_lifetime_delta: 0,
      p_grant_tier_id: null,
      p_reason: "Bù điểm đơn lỗi",
      p_actor: { id: "staff-1", email: "staff@shop.test" },
    })
  })

  // The form submits "" for "no tier". Forwarding that verbatim would make the
  // RPC try to look up a tier whose id is the empty string.
  it("turns an empty grant_tier_id into null", async () => {
    await adjustPoints(input({ grant_tier_id: "" }))
    expect(admin.rpc.mock.calls[0]?.[1]).toMatchObject({ p_grant_tier_id: null })
  })

  it("forwards a real tier id untouched", async () => {
    await adjustPoints(input({ grant_tier_id: TIER }))
    expect(admin.rpc.mock.calls[0]?.[1]).toMatchObject({ p_grant_tier_id: TIER })
  })

  // Clamping belongs to the RPC, which holds the row lock. A second opinion in
  // the action could only ever disagree with it.
  it("forwards a negative delta rather than clamping it here", async () => {
    await adjustPoints(input({ current_delta: -200 }))
    expect(admin.rpc.mock.calls[0]?.[1]).toMatchObject({ p_current_delta: -200 })
  })

  // The ledger row and the balance must not be able to diverge, which is only
  // true while every change goes through adjust_points.
  it("never writes to public.customers itself", async () => {
    await adjustPoints(input())
    expect(admin.queries).toHaveLength(0)
    expect(server.queriesFor("customers")).toHaveLength(0)
  })
})

describe("the failure taxonomy a staff member reads", () => {
  it("names an insufficient balance", async () => {
    admin.rpcReplies.set("adjust_points", pgFail("P0003"))
    expect(await adjustPoints(input())).toEqual({
      ok: false,
      message: "insufficient",
    })
  })

  it("names a no-op adjustment", async () => {
    admin.rpcReplies.set("adjust_points", pgFail("P0005"))
    expect(await adjustPoints(input())).toEqual({
      ok: false,
      message: "noChange",
    })
  })

  it("falls back to a generic failure for anything else", async () => {
    admin.rpcReplies.set("adjust_points", pgFail("23503"))
    expect(await adjustPoints(input())).toEqual({
      ok: false,
      message: "saveFailed",
    })
  })

  it("revalidates nothing when the RPC refused", async () => {
    admin.rpcReplies.set("adjust_points", pgFail("P0003"))
    await adjustPoints(input())
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  // Both portals read the columns this moved, so both have to be busted.
  it("revalidates both portals on success", async () => {
    await adjustPoints(input())
    const paths = vi.mocked(revalidatePath).mock.calls.map(([p]) => p)
    expect(paths).toEqual(
      expect.arrayContaining([
        `/admin/customers/${CUSTOMER}`,
        "/admin/customers",
        "/admin/transactions",
        "/dashboard",
        "/tiers",
        "/history",
      ]),
    )
  })
})
