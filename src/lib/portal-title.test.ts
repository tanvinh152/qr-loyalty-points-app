import { describe, expect, it } from "vitest"

import { resolvePortalTitle, type PortalTitle } from "./portal-title"

const TITLES: PortalTitle[] = [
  { href: "/admin", label: "Tổng quan", exact: true },
  { href: "/admin/tiers", label: "Hạng" },
  { href: "/admin/customers", label: "Khách hàng" },
]

describe("resolvePortalTitle", () => {
  it("matches the exact entry only on its own path", () => {
    expect(resolvePortalTitle(TITLES, "/admin")).toEqual({ label: "Tổng quan" })
  })

  it("does not let the exact entry claim a sub-route", () => {
    // Without `exact`, `/admin` would be the answer for every admin page.
    expect(resolvePortalTitle(TITLES, "/admin/tiers")?.label).toBe("Hạng")
  })

  it("matches a prefix entry on its own page with no parent", () => {
    expect(resolvePortalTitle(TITLES, "/admin/customers")).toEqual({
      label: "Khách hàng",
    })
  })

  it("reports the section as the parent of a detail route", () => {
    // This is what the header's back chevron points at.
    expect(resolvePortalTitle(TITLES, "/admin/customers/abc-123")).toEqual({
      label: "Khách hàng",
      parent: "/admin/customers",
    })
  })

  it("does not let a shared string prefix match a different route", () => {
    // The guard is the trailing slash in `${href}/`.
    expect(resolvePortalTitle(TITLES, "/admin/tiersomething")).toBeNull()
  })

  it("prefers the deepest entry that claims the path", () => {
    const nested: PortalTitle[] = [
      ...TITLES,
      { href: "/admin/customers/import", label: "Nhập khẩu" },
    ]
    expect(resolvePortalTitle(nested, "/admin/customers/import")).toEqual({
      label: "Nhập khẩu",
    })
  })

  it("returns null rather than guessing for an unmapped route", () => {
    // /admin/spin/winners is real and has no nav entry. Naming it after some
    // ancestor would tell the reader they are somewhere they are not.
    expect(resolvePortalTitle(TITLES, "/admin/spin/winners")).toBeNull()
  })
})
