import { beforeEach, describe, expect, it, vi } from "vitest"

// next/headers reads from an async request store that does not exist under the
// test runner, so the whole module is replaced by a plain map.
const headerStore = new Map<string, string>()
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerStore.get(name.toLowerCase()) ?? null,
  }),
}))

const { getClientIp } = await import("./rate-limit")

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
