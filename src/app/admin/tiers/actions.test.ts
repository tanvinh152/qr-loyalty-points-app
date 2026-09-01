import { beforeEach, describe, expect, it, vi } from "vitest"

import { keyed } from "@/test/messages"
import {
  adminUser,
  createSupabaseFake,
  memberUser,
  ok,
} from "@/test/supabase"

// Four of the five actions here reach for the SERVICE-ROLE client, which
// bypasses RLS. Each one therefore re-checks the admin claim itself through
// requireAdmin() — the /admin proxy guard never sees a direct POST to a Server
// Action. saveTier is the exception: it stays on the cookie-scoped client.

const server = createSupabaseFake()
const admin = createSupabaseFake()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/i18n/server", () => ({
  getMessages: async () => ({ validation: keyed(), admin: { tiers: keyed() } }),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => server.client }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.client }))

const {
  saveTier,
  saveTierSchedule,
  cancelTierSchedule,
  previewPercentileAmount,
  applyDueTierSchedules,
} = await import("./actions")

const TIER = "55555555-5555-4555-8555-555555555555"
const SCHEDULE = "66666666-6666-4666-8666-666666666666"

const schedule = (over: Record<string, unknown> = {}) =>
  ({
    tier_id: TIER,
    mode: "amount",
    target_amount: 5_000_000,
    target_percentile: "",
    effective_at: "2026-03-01T00:00",
    note: "",
    ...over,
  }) as never

beforeEach(() => {
  server.reset()
  admin.reset()
  vi.spyOn(console, "error").mockImplementation(() => {})
  server.user = adminUser()
})

describe("every service-role path re-checks the claim itself", () => {
  const nonAdmins = [
    ["anonymous", null],
    ["a member with no claim", memberUser()],
    ["a member with a role in user_metadata", memberUser({ user_metadata: { role: "admin" } })],
  ] as const

  it.each(nonAdmins)("saveTierSchedule refuses %s", async (_who, user) => {
    server.user = user
    expect(await saveTierSchedule(schedule())).toMatchObject({ ok: false })
    expect(admin.queries).toHaveLength(0)
  })

  it.each(nonAdmins)("cancelTierSchedule refuses %s", async (_who, user) => {
    server.user = user
    expect(await cancelTierSchedule(SCHEDULE)).toMatchObject({ ok: false })
    expect(admin.queries).toHaveLength(0)
  })

  it.each(nonAdmins)("applyDueTierSchedules is a no-op for %s", async (_who, user) => {
    server.user = user
    await applyDueTierSchedules()
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  // Not a cosmetic guard: the answer is a real đồng figure derived from the
  // whole member base's spending. Handing it to a stranger leaks the shop's
  // revenue distribution.
  it.each(nonAdmins)("previewPercentileAmount tells %s nothing", async (_who, user) => {
    server.user = user
    expect(await previewPercentileAmount(5)).toBeNull()
    expect(admin.rpc).not.toHaveBeenCalled()
  })
})

describe("saveTierSchedule", () => {
  // Validation runs BEFORE requireAdmin, which is fine only because both
  // branches end in a refusal — neither reaches a service-role insert.
  it("rejects a malformed payload without inserting", async () => {
    expect(await saveTierSchedule(schedule({ tier_id: "nope" }))).toMatchObject({
      ok: false,
    })
    expect(admin.queries).toHaveLength(0)
  })

  it("refuses an amount schedule with no amount", async () => {
    expect(
      await saveTierSchedule(schedule({ target_amount: "" })),
    ).toMatchObject({ ok: false })
    expect(admin.queries).toHaveLength(0)
  })

  it("refuses a percentile schedule with no percentile", async () => {
    expect(
      await saveTierSchedule(
        schedule({ mode: "percentile", target_amount: "", target_percentile: "" }),
      ),
    ).toMatchObject({ ok: false })
    expect(admin.queries).toHaveLength(0)
  })

  // 0đ is not a tier, it is every member at once; 0% selects nobody and 100%
  // the whole base.
  it.each([["0"], ["-1"]])("refuses a target amount of %j", async (target_amount) => {
    expect(await saveTierSchedule(schedule({ target_amount }))).toMatchObject({
      ok: false,
    })
  })

  it.each([["0"], ["100"], ["101"]])(
    "refuses a percentile of %j",
    async (target_percentile) => {
      expect(
        await saveTierSchedule(
          schedule({ mode: "percentile", target_amount: "", target_percentile }),
        ),
      ).toMatchObject({ ok: false })
    },
  )

  // The check constraint on tier_threshold_schedules insists the unused column
  // is NULL. Carrying a stale amount across a mode switch trips it.
  it("nulls the percentile column for an amount schedule", async () => {
    await saveTierSchedule(schedule())
    expect(admin.query("tier_threshold_schedules", "insert")?.arg).toMatchObject({
      mode: "amount",
      target_amount: 5_000_000,
      target_percentile: null,
    })
  })

  it("nulls the amount column even when the form still carried one", async () => {
    await saveTierSchedule(
      schedule({ mode: "percentile", target_amount: 5_000_000, target_percentile: 5 }),
    )
    expect(admin.query("tier_threshold_schedules", "insert")?.arg).toMatchObject({
      mode: "percentile",
      target_amount: null,
      target_percentile: 5,
    })
  })

  // datetime-local carries no zone. Reading it in the server process's local
  // time (UTC on a typical serverless deploy) shifted every raise by 7 hours.
  // Vietnam has no DST, so the offset is always exactly +07:00.
  it("anchors the effective date to Vietnam, not to the server's zone", async () => {
    await saveTierSchedule(schedule({ effective_at: "2026-03-01T00:00" }))
    expect(admin.query("tier_threshold_schedules", "insert")?.arg).toMatchObject({
      effective_at: "2026-02-28T17:00:00.000Z",
    })
  })

  it("stores an empty note as null", async () => {
    await saveTierSchedule(schedule({ note: "" }))
    expect(admin.query("tier_threshold_schedules", "insert")?.arg).toMatchObject({
      note: null,
    })
  })

  // Two queued raises for one tier would apply in an order nobody chose, so the
  // partial unique index refuses the second — by name, not as a generic failure.
  it("names a duplicate pending schedule", async () => {
    admin.tableReplies.set("tier_threshold_schedules.insert", {
      data: null,
      error: { code: "23505" },
    })
    expect(await saveTierSchedule(schedule())).toEqual({
      ok: false,
      message: "scheduleDuplicate",
    })
  })
})

describe("cancelTierSchedule", () => {
  it("refuses an empty id before checking anything", async () => {
    expect(await cancelTierSchedule("")).toMatchObject({ ok: false })
    expect(admin.queries).toHaveLength(0)
  })

  // An already-applied schedule is the audit trail of a threshold that really
  // moved — and the only record of what a percentile resolved to. Deleting one
  // would erase that, so the predicate, not just the UI, has to exclude it.
  it("can only delete a schedule that has not been applied", async () => {
    await cancelTierSchedule(SCHEDULE)
    expect(admin.query("tier_threshold_schedules", "delete")?.filters).toEqual([
      { fn: "eq", args: ["id", SCHEDULE] },
      { fn: "is", args: ["applied_at", null] },
    ])
  })
})

describe("previewPercentileAmount", () => {
  it.each([[0], [100], [101], [-5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "refuses %p before it can reach the database",
    async (percentile) => {
      expect(await previewPercentileAmount(percentile)).toBeNull()
      expect(admin.rpc).not.toHaveBeenCalled()
    },
  )

  it("asks the ranking function for a real figure", async () => {
    admin.rpcReplies.set("tier_percentile_amount", ok(12_500_000))
    expect(await previewPercentileAmount(5)).toBe(12_500_000)
    expect(admin.rpc).toHaveBeenCalledWith("tier_percentile_amount", {
      p_percentile: 5,
    })
  })

  it("answers null rather than a wrong number when the query failed", async () => {
    admin.rpcReplies.set("tier_percentile_amount", {
      data: null,
      error: { code: "42501" },
    })
    expect(await previewPercentileAmount(5)).toBeNull()
  })
})

describe("saveTier stays adjust-only", () => {
  // The five tiers are a fixed ladder. A payload with no id has nothing to
  // update, so it must be refused rather than silently creating a sixth tier.
  it("refuses a payload with no id instead of inserting a new tier", async () => {
    const res = await saveTier({
      name: "Kim cương",
      spend_threshold: 1_000_000,
      multiplier: 1.2,
      sort_order: 6,
      benefits: "",
      perks: [],
    } as never)

    expect(res).toEqual({ ok: false, message: "saveFailed" })
    expect(server.queriesFor("membership_tiers", "insert")).toHaveLength(0)
    expect(server.queriesFor("membership_tiers", "update")).toHaveLength(0)
  })
})
