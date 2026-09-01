import { beforeEach, describe, expect, it, vi } from "vitest"

import { keyed } from "@/test/messages"
import { createSupabaseFake, ok } from "@/test/supabase"

// saveSettings writes the numbers every later point calculation is measured
// against. It runs on the COOKIE-SCOPED client, so RLS `is_admin()` (0005) is
// the only guard in front of it — see the guard rail at the bottom of this file.

const server = createSupabaseFake()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/i18n/server", () => ({
  getMessages: async () => ({ validation: keyed(), admin: { settings: keyed() } }),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => server.client }))

// This action must never reach for the service-role client: that one bypasses
// RLS, and nothing here re-checks the admin claim. If someone "fixes an RLS
// problem" by swapping the import, this throws instead of quietly shipping an
// unauthenticated write to the loyalty rules.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("service-role client used without an admin re-check")
  },
}))

const { revalidatePath } = await import("next/cache")
const { saveSettings } = await import("./actions")

const VALID = {
  rounding: "floor",
  vnd_per_point: "1000",
  welcome_gift_points: "0",
  checkin_points: "10",
  spin_daily_limit: "1",
  claimable_statuses: "3, 16",
}

function form(over: Partial<Record<keyof typeof VALID, string>> = {}) {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ ...VALID, ...over })) fd.set(k, v)
  return fd
}

const save = (over?: Partial<Record<keyof typeof VALID, string>>) =>
  saveSettings(null, form(over))

beforeEach(() => {
  server.reset()
  vi.mocked(revalidatePath).mockClear()
  // An active row exists by default: that is the shape production is always in.
  server.tableReplies.set("loyalty_settings.select", ok({ id: "settings-1" }))
})

describe("vnd_per_point is a divisor, so it can never reach zero", () => {
  it.each([["0"], ["-1"], ["abc"], [""]])(
    "refuses %j without writing anything",
    async (vnd_per_point) => {
      const res = await save({ vnd_per_point })
      expect(res?.ok).toBe(false)
      expect(server.queries).toHaveLength(0)
    },
  )

  it("accepts the smallest legal divisor", async () => {
    expect((await save({ vnd_per_point: "1" }))?.ok).toBe(true)
  })
})

describe("claimable_statuses decides which orders earn at all", () => {
  // Number("") is 0, and 0 is Pancake's "new" — a stray trailing comma used to
  // make brand-new, unpaid orders claimable.
  it("drops an empty segment instead of parsing it as status 0", async () => {
    expect((await save({ claimable_statuses: "3, 16," }))?.ok).toBe(true)
    expect(server.query("loyalty_settings", "update")?.arg).toMatchObject({
      claimable_statuses: [3, 16],
    })
  })

  it("survives messy whitespace and repeated commas", async () => {
    await save({ claimable_statuses: " 3 ,, 16 , " })
    expect(server.query("loyalty_settings", "update")?.arg).toMatchObject({
      claimable_statuses: [3, 16],
    })
  })

  // A typo'd status would otherwise be a silent no-op: no order ever matches it,
  // so points quietly stop being awarded and nothing looks broken.
  it.each([["999"], ["3, 999"], ["three"], [""], ["   "]])(
    "refuses %j rather than storing a status that can never match",
    async (claimable_statuses) => {
      expect((await save({ claimable_statuses }))?.ok).toBe(false)
      expect(server.queries).toHaveLength(0)
    },
  )
})

describe("the other counters", () => {
  it.each([
    ["welcome_gift_points"],
    ["checkin_points"],
    ["spin_daily_limit"],
  ] as const)("refuses a negative %s", async (field) => {
    expect((await save({ [field]: "-1" }))?.ok).toBe(false)
    expect(server.queries).toHaveLength(0)
  })

  // 0 is not invalid here — it is how each of these features is switched off.
  it.each([
    ["welcome_gift_points"],
    ["checkin_points"],
    ["spin_daily_limit"],
  ] as const)("accepts 0 for %s, which is how the feature is turned off", async (field) => {
    expect((await save({ [field]: "0" }))?.ok).toBe(true)
  })

  it("refuses a rounding mode the RPC does not implement", async () => {
    expect((await save({ rounding: "banker" }))?.ok).toBe(false)
    expect(server.queries).toHaveLength(0)
  })
})

describe("upserting the single active row", () => {
  it("updates the existing row in place and inserts nothing", async () => {
    await save()

    expect(server.queriesFor("loyalty_settings", "update")).toHaveLength(1)
    expect(server.queriesFor("loyalty_settings", "insert")).toHaveLength(0)
    expect(server.query("loyalty_settings", "update")?.filters).toEqual([
      { fn: "eq", args: ["id", "settings-1"] },
    ])
  })

  it("inserts a first row when none is active yet", async () => {
    server.tableReplies.set("loyalty_settings.select", ok(null))
    await save()

    expect(server.queriesFor("loyalty_settings", "insert")).toHaveLength(1)
    expect(server.queriesFor("loyalty_settings", "update")).toHaveLength(0)
    expect(server.query("loyalty_settings", "insert")?.arg).toMatchObject({
      is_active: true,
    })
  })

  // FormData is all strings. Storing "1000" in a numeric column is a coercion
  // Postgres would do silently — until the day it cannot.
  it("stores coerced numbers, not the raw form strings", async () => {
    await save({ vnd_per_point: "2000", checkin_points: "5" })
    const payload = server.query("loyalty_settings", "update")?.arg as Record<
      string,
      unknown
    >
    expect(payload.vnd_per_point).toBe(2000)
    expect(payload.checkin_points).toBe(5)
    expect(payload.updated_at).toEqual(expect.any(String))
  })
})

describe("what a save busts", () => {
  it("revalidates the settings screen and the gift screen", async () => {
    await save()
    expect(vi.mocked(revalidatePath).mock.calls.map(([p]) => p)).toEqual([
      "/admin/settings",
      "/admin/rewards",
    ])
  })

  it("revalidates nothing when the write failed", async () => {
    server.tableReplies.set("loyalty_settings.update", {
      data: null,
      error: { code: "42501" },
    })
    expect((await save())?.ok).toBe(false)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
