import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

// The edge guard in front of BOTH portals, and the only code that refreshes the
// session cookie. Everything here is asserted against the real NextRequest /
// NextResponse — only Supabase is faked, because `getUser()` is the single
// input the redirect matrix branches on.

const getUser = vi.fn()
let cookieOpts: {
  cookies: {
    getAll: () => unknown
    setAll: (c: { name: string; value: string; options: object }[]) => void
  }
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: typeof cookieOpts) => {
    cookieOpts = opts
    return { auth: { getUser } }
  },
}))

const { NextRequest } = await import("next/server")
const { updateSession } = await import("./middleware")

type Who = "anon" | "member" | "staff"

const USERS = {
  anon: null,
  member: { id: "u-member", app_metadata: {} },
  // The claim lives in app_metadata precisely because it is service-role
  // writable only — a customer cannot self-assign it.
  staff: { id: "u-staff", app_metadata: { role: "admin" } },
} as const

const req = (path: string) => new NextRequest(new URL(path, "https://shop.test"))

function redirectedTo(res: Response): URL | null {
  const raw = res.headers.get("location")
  return raw ? new URL(raw) : null
}

/** The redirect target's pathname, or null when the request passed through. */
const where = (res: Response) => redirectedTo(res)?.pathname ?? null

async function visit(path: string, who: Who) {
  getUser.mockResolvedValue({ data: { user: USERS[who] } })
  return updateSession(req(path))
}

beforeEach(() => {
  getUser.mockReset()
})

describe("the redirect matrix", () => {
  it.each<[string, Who, string | null]>([
    // Unauthenticated on a protected admin route.
    ["/admin", "anon", "/admin/login"],
    ["/admin/customers/abc", "anon", "/admin/login"],
    // ...but the admin login itself must stay reachable, or it is a loop.
    ["/admin/login", "anon", null],

    // A customer session must not linger anywhere under /admin.
    ["/admin", "member", "/dashboard"],
    ["/admin/settings", "member", "/dashboard"],
    // Subtle and worth pinning: the customer rule is checked BEFORE the
    // "already staff on the login page" rule, so a member on /admin/login is
    // sent to /dashboard rather than being allowed to sit on the staff form.
    ["/admin/login", "member", "/dashboard"],

    ["/admin/login", "staff", "/admin"],
    ["/admin", "staff", null],

    // The whole account area needs a session.
    ["/dashboard", "anon", "/login"],
    ["/rewards", "anon", "/login"],
    ["/tiers", "anon", "/login"],
    ["/history", "anon", "/login"],
    ["/help", "anon", "/login"],
    ["/profile", "anon", "/login"],
    // A nested page has to inherit the guard from its prefix.
    ["/rewards/roadmap", "anon", "/login"],
    ["/dashboard", "member", null],

    // A signed-in visitor has no business on the customer auth screens.
    ["/login", "member", "/dashboard"],
    ["/register", "member", "/dashboard"],
    ["/login", "staff", "/admin"],
    ["/register", "staff", "/admin"],
    ["/login", "anon", null],

    // Public on purpose: /register links to /terms, so gating it would bounce
    // an anonymous signer-up to /login.
    ["/faq", "anon", null],
    ["/terms", "anon", null],
    ["/blog/post-1", "anon", null],
    ["/", "anon", null],

    // The wheel is a dialog, not a route. Documents the deliberate hole.
    ["/spin", "anon", null],

    // The prefix must match at a segment boundary. A substring match would
    // make these redirect, and would eventually swallow an unrelated route.
    ["/dashboardish", "anon", null],
    ["/rewardsx", "anon", null],
  ])("%s as %s -> %s", async (path, who, expected) => {
    expect(where(await visit(path, who))).toBe(expected)
  })
})

describe("the details that are easy to regress", () => {
  it("asks Supabase who the user is exactly once per request", async () => {
    await visit("/dashboard", "member")
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  // Pins current behaviour AND flags what is missing: the destination is
  // dropped, so a member who deep-linked lands on /login and then /dashboard,
  // never where they were headed. Add a ?next= round-trip and this is the test
  // to update.
  it("strips the search from the redirect target", async () => {
    const url = redirectedTo(await visit("/history?page=3&from=%2Fx", "anon"))
    expect(url?.pathname).toBe("/login")
    expect(url?.search).toBe("")
  })

  // The one line keeping sessions alive. Supabase calls setAll() when it
  // refreshes the token; updateSession has to rebuild the response so the new
  // cookie reaches the browser.
  it("carries a refreshed auth cookie onto the response", async () => {
    getUser.mockImplementation(async () => {
      cookieOpts.cookies.setAll([
        { name: "sb-access-token", value: "refreshed", options: {} },
      ])
      return { data: { user: USERS.member } }
    })

    const res = await updateSession(req("/dashboard"))
    expect(res.cookies.get("sb-access-token")?.value).toBe("refreshed")
  })
})

describe("what does NOT make someone staff", () => {
  it.each([
    ["Admin"],
    ["ADMIN"],
    ["admin "],
    [" admin"],
    ["administrator"],
  ])("app_metadata.role = %j is not the admin claim", async (role) => {
    getUser.mockResolvedValue({ data: { user: { id: "u", app_metadata: { role } } } })
    // Not staff -> pushed out of /admin like any other customer.
    expect(where(await updateSession(req("/admin")))).toBe("/dashboard")
  })

  // user_metadata is writable by the user themselves. Reading the role from
  // there instead of app_metadata would let anyone mint an admin session.
  it("ignores a role in user_metadata", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u", app_metadata: {}, user_metadata: { role: "admin" } } },
    })
    expect(where(await updateSession(req("/admin")))).toBe("/dashboard")
  })
})

// ACCOUNT_PREFIXES is a hand-maintained allow-list and is not exported. It has
// already been wrong once — the comment in middleware.ts records that it used to
// hold only three of the six. A new route under (account)/ that nobody adds to
// the list ships unguarded at the edge, relying on getAccount()'s render-time
// redirect alone. So check it against what is actually on disk.
describe("the allow-list against the routes that exist", () => {
  const DIR = join(process.cwd(), "src/app/(customer)/(account)")

  const routes = readdirSync(DIR, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("("),
    )
    // /spin is a page-less folder holding only server actions — correctly
    // excluded, because it is not a route anyone can navigate to.
    .filter((e) => existsSync(join(DIR, e.name, "page.tsx")))
    .map((e) => `/${e.name}`)

  it("found the account routes at all", () => {
    // A broken glob must fail loudly rather than pass vacuously.
    expect(routes.length).toBeGreaterThan(0)
  })

  it.each(routes)("guards %s at the edge", async (path) => {
    expect(where(await visit(path, "anon"))).toBe("/login")
  })
})
