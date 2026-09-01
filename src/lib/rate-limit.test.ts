import { beforeEach, describe, expect, it, vi } from "vitest"

// next/headers reads from an async request store that does not exist under the
// test runner, so the whole module is replaced by a plain map.
const headerStore = new Map<string, string>()
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerStore.get(name.toLowerCase()) ?? null,
  }),
}))

import { createSupabaseFake } from "@/test/supabase"

const db = createSupabaseFake()
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db.client }))

const {
  getClientIp,
  isRateLimited,
  recordAttempt,
  isLoginRateLimited,
  recordLoginAttempt,
} = await import("./rate-limit")

function setHeaders(entries: Record<string, string>) {
  headerStore.clear()
  for (const [name, value] of Object.entries(entries)) {
    headerStore.set(name.toLowerCase(), value)
  }
}

// This value keys the only brute-force limit standing between a guesser and the
// masked-phone check, so what it trusts matters more than it looks.
describe("getClientIp", () => {
  beforeEach(() => headerStore.clear())

  it("prefers the platform header over anything the client can set", async () => {
    setHeaders({
      "x-vercel-forwarded-for": "203.0.113.9",
      "x-real-ip": "198.51.100.5",
      "x-forwarded-for": "1.2.3.4, 198.51.100.5",
    })
    await expect(getClientIp()).resolves.toBe("203.0.113.9")
  })

  it("falls back to x-real-ip before touching x-forwarded-for", async () => {
    setHeaders({
      "x-real-ip": "198.51.100.5",
      "x-forwarded-for": "1.2.3.4, 198.51.100.5",
    })
    await expect(getClientIp()).resolves.toBe("198.51.100.5")
  })

  // The regression this guards: a spoofed leftmost entry used to become the
  // rate-limit key, so rotating it per request bypassed the limit entirely.
  it("takes the rightmost x-forwarded-for hop, not the client-supplied one", async () => {
    setHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 198.51.100.5" })
    await expect(getClientIp()).resolves.toBe("198.51.100.5")
  })

  it("ignores blank hops and surrounding whitespace", async () => {
    setHeaders({ "x-forwarded-for": " 1.2.3.4 , ,  198.51.100.5  " })
    await expect(getClientIp()).resolves.toBe("198.51.100.5")
  })

  it("still yields a key when nothing usable is present", async () => {
    setHeaders({ "x-forwarded-for": " , " })
    await expect(getClientIp()).resolves.toBe("unknown")

    headerStore.clear()
    await expect(getClientIp()).resolves.toBe("unknown")
  })
})

// The counters live in Postgres because serverless instances share nothing in
// memory. These are the halves getClientIp cannot cover: what the module asks
// the database, and what it does when the database will not answer.
describe("isRateLimited", () => {
  beforeEach(() => db.reset())

  const attempts = (count: number | null) => ({ count, error: null })

  it("lets a caller through while they are under budget", async () => {
    db.tableReplies.set("claim_attempts", attempts(4))
    expect(await isRateLimited("1.2.3.4")).toBe(false)
  })

  it("refuses the caller once the IP hits five failures", async () => {
    db.tableReplies.set("claim_attempts", attempts(5))
    expect(await isRateLimited("1.2.3.4")).toBe(true)
  })

  it("counts only failures, inside the 15-minute window", async () => {
    db.tableReplies.set("claim_attempts", attempts(0))
    await isRateLimited("1.2.3.4")

    const q = db.query("claim_attempts", "select")
    expect(q?.opts).toMatchObject({ count: "exact", head: true })
    expect(q?.filters).toEqual([
      { fn: "eq", args: ["ip", "1.2.3.4"] },
      { fn: "eq", args: ["succeeded", false] },
      { fn: "gte", args: ["created_at", expect.any(String)] },
    ])

    const since = q?.filters[2]?.args[1] as string
    const ago = Date.now() - new Date(since).getTime()
    expect(ago).toBeGreaterThan(14 * 60_000)
    expect(ago).toBeLessThan(16 * 60_000)
  })

  it("does not look at the order code unless one was given", async () => {
    db.tableReplies.set("claim_attempts", attempts(0))
    await isRateLimited("1.2.3.4")
    expect(db.queriesFor("claim_attempts")).toHaveLength(1)
  })

  // Order codes are partly sequential (Pancake system_id), so a guesser
  // rotating IPs is throttled by the ORDER as well. The two budgets are
  // independent: being under the IP limit must not excuse the order limit.
  it("throttles a hammered order code even from a fresh IP", async () => {
    // The two budgets are independent, so this pins the IP count under the
    // limit and the order count at it: only the second query may refuse.
    db.tableReplies.set("claim_attempts", (q) =>
      q.filters.some((f) => f.args[0] === "order_code")
        ? attempts(5)
        : attempts(0),
    )

    expect(await isRateLimited("1.2.3.4", "ORDER-A")).toBe(true)
    expect(db.queriesFor("claim_attempts")).toHaveLength(2)
    expect(db.query("claim_attempts")?.filters).toEqual([
      { fn: "eq", args: ["order_code", "ORDER-A"] },
      { fn: "eq", args: ["succeeded", false] },
      { fn: "gte", args: ["created_at", expect.any(String)] },
    ])
  })

  it("does not refuse a fresh order code just because it exists", async () => {
    db.tableReplies.set("claim_attempts", attempts(0))
    expect(await isRateLimited("1.2.3.4", "ORDER-B")).toBe(false)
  })

  // The order query fails open on its own, independently of the IP one.
  it("still answers on the IP budget when the order count errors", async () => {
    db.tableReplies.set("claim_attempts", (q) =>
      q.filters.some((f) => f.args[0] === "order_code")
        ? { count: null, error: { code: "57P01" } }
        : attempts(0),
    )
    expect(await isRateLimited("1.2.3.4", "ORDER-A")).toBe(false)
  })

  // Deliberately fails OPEN. Losing the throttle for the duration of an outage
  // beats taking the whole claim flow down with it.
  it("lets callers through when the counter itself is unavailable", async () => {
    db.tableReplies.set("claim_attempts", { count: null, error: { code: "57P01" } })
    expect(await isRateLimited("1.2.3.4")).toBe(false)
  })
})

describe("recordAttempt", () => {
  beforeEach(() => db.reset())

  it("books the outcome against both the IP and the order", async () => {
    await recordAttempt("1.2.3.4", "ORDER-A", false)
    expect(db.query("claim_attempts", "insert")?.arg).toEqual({
      ip: "1.2.3.4",
      order_code: "ORDER-A",
      succeeded: false,
    })
  })

  it("stores a null order code rather than inventing one", async () => {
    await recordAttempt("1.2.3.4", null, true)
    expect(db.query("claim_attempts", "insert")?.arg).toMatchObject({
      order_code: null,
      succeeded: true,
    })
  })
})

// The admin password is the highest-privilege credential in the system and had
// no throttle at all before 0021. It gets its own table so a flood of customer
// signups can never exhaust the staff budget, or vice versa.
describe("isLoginRateLimited", () => {
  beforeEach(() => db.reset())

  it("refuses once the IP hits five failed logins", async () => {
    db.tableReplies.set("admin_login_attempts", { count: 5, error: null })
    expect(await isLoginRateLimited("1.2.3.4")).toBe(true)
  })

  it("lets the caller through under budget", async () => {
    db.tableReplies.set("admin_login_attempts", { count: 4, error: null })
    expect(await isLoginRateLimited("1.2.3.4")).toBe(false)
  })

  it("reads its own table, never the claim counters", async () => {
    db.tableReplies.set("admin_login_attempts", { count: 0, error: null })
    await isLoginRateLimited("1.2.3.4")
    expect(db.queriesFor("admin_login_attempts")).toHaveLength(1)
    expect(db.queriesFor("claim_attempts")).toHaveLength(0)
  })

  it("fails open like the claim throttle does", async () => {
    db.tableReplies.set("admin_login_attempts", {
      count: null,
      error: { code: "57P01" },
    })
    expect(await isLoginRateLimited("1.2.3.4")).toBe(false)
  })

  it("records a login attempt on its own table", async () => {
    await recordLoginAttempt("1.2.3.4", false)
    expect(db.query("admin_login_attempts", "insert")?.arg).toEqual({
      ip: "1.2.3.4",
      succeeded: false,
    })
  })
})
