import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"
import { route } from "@/test/route"
import { PortalNav, type PortalNavItem } from "./portal-nav"

const ITEMS: PortalNavItem[] = [
  { href: "/admin", label: "Tổng quan", icon: "dashboard", exact: true },
  { href: "/admin/tiers", label: "Hạng", icon: "tiers" },
  { href: "/admin/rewards", label: "Quà", icon: "rewards" },
]

function at(pathname: string) {
  route.pathname = pathname
  renderWithProviders(<PortalNav items={ITEMS} label="Quản trị" variant="rail" />)
}

/** Labels of the links currently marked as the active page. */
function activeLabels() {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent)
}

describe("PortalNav", () => {
  it("marks the exact item only on its own path", () => {
    // `/admin` is the portal root; without `exact` it would light up everywhere.
    at("/admin")
    expect(activeLabels()).toEqual(["Tổng quan"])
  })

  it("does not mark the exact item on a sub-route", () => {
    at("/admin/tiers")
    expect(activeLabels()).toEqual(["Hạng"])
  })

  it("marks a prefix item on its own nested routes", () => {
    at("/admin/tiers/3f2504e0-4f89-41d3-9a0c-0305e82c3301")
    expect(activeLabels()).toEqual(["Hạng"])
  })

  it("does not let a shared string prefix match a different route", () => {
    // The guard is the trailing slash in `${item.href}/`. Without it,
    // /admin/tiersomething would light up the tiers tab.
    at("/admin/tiersomething")
    expect(activeLabels()).toEqual([])
  })

  it("never marks two items at once", () => {
    for (const path of ["/admin", "/admin/tiers", "/admin/rewards"]) {
      route.pathname = path
      const { unmount } = renderWithProviders(
        <PortalNav items={ITEMS} label="Quản trị" variant="rail" />,
      )
      expect(activeLabels()).toHaveLength(1)
      unmount()
    }
  })

  it("names each variant so the two navigations are distinguishable", () => {
    // Both render at once on small screens; identical names would give a screen
    // reader two indistinguishable navigations.
    route.pathname = "/admin"
    renderWithProviders(
      <>
        <PortalNav items={ITEMS} label="Thanh bên" variant="rail" />
        <PortalNav items={ITEMS} label="Thanh dưới" variant="bottom" />
      </>,
    )
    const names = screen
      .getAllByRole("navigation")
      .map((nav) => nav.getAttribute("aria-label"))
    expect(names).toEqual(["Thanh bên", "Thanh dưới"])
  })

  describe("collapsed rail", () => {
    it("keeps each link's accessible name", () => {
      // The whole point of hiding the label with `sr-only` rather than
      // `hidden`. Swap it for display:none and a collapsed rail becomes a
      // column of nameless icons — a regression no sighted reviewer can see.
      route.pathname = "/admin"
      renderWithProviders(
        <PortalNav
          items={ITEMS}
          label="Thanh bên"
          variant="rail"
          collapsed
        />,
      )
      for (const item of ITEMS) {
        expect(screen.getByRole("link", { name: item.label })).toBeTruthy()
      }
    })

    it("adds a title only when collapsed", () => {
      route.pathname = "/admin"
      const { unmount } = renderWithProviders(
        <PortalNav items={ITEMS} label="Thanh bên" variant="rail" />,
      )
      expect(
        screen.getByRole("link", { name: "Hạng" }).getAttribute("title"),
      ).toBeNull()
      unmount()

      renderWithProviders(
        <PortalNav
          items={ITEMS}
          label="Thanh bên"
          variant="rail"
          collapsed
        />,
      )
      expect(
        screen.getByRole("link", { name: "Hạng" }).getAttribute("title"),
      ).toBe("Hạng")
    })
  })
})
