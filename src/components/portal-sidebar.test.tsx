import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { setSidebarCollapsed } from "@/lib/sidebar/actions"
import { renderWithProviders } from "@/test/render"
import { route } from "@/test/route"
import { PortalNavItem } from "./portal-nav"
import {
  SidebarCta,
  SidebarProvider,
  SidebarRail,
  SidebarToggle,
} from "./portal-sidebar"

// `@/lib/sidebar/actions` is "use server" and pulls next/headers, so it is
// mocked globally in src/test/setup.ts alongside the theme action.

const ITEMS: PortalNavItem[] = [
  { href: "/admin", label: "Tổng quan", icon: "dashboard", exact: true },
  { href: "/admin/tiers", label: "Hạng", icon: "tiers" },
]

function renderShell(initialCollapsed = false) {
  route.pathname = "/admin"
  return renderWithProviders(
    <SidebarProvider initialCollapsed={initialCollapsed}>
      <SidebarToggle />
      <SidebarRail
        items={ITEMS}
        navLabel="Thanh bên"
        brand={<span>ChiCha Membership</span>}
        brandMark={<span>Dấu thương hiệu</span>}
        footer={
          <div>
            <form action="/logout">
              <button type="submit">Đăng xuất</button>
            </form>
            <SidebarCta
              href="/tiers"
              label="Nâng hạng"
              icon={<span aria-hidden>↑</span>}
            />
          </div>
        }
      />
    </SidebarProvider>,
  )
}

function rail() {
  return screen.getByRole("navigation", { name: "Thanh bên" }).closest("aside")
}

describe("PortalSidebar", () => {
  beforeEach(() => {
    vi.mocked(setSidebarCollapsed).mockClear()
  })

  it("starts expanded when the cookie said so", () => {
    renderShell(false)
    expect(rail()).not.toHaveAttribute("data-collapsed")
    expect(screen.getByRole("button", { name: "Thu gọn thanh bên" })).toBeTruthy()
  })

  it("starts collapsed when the cookie said so", () => {
    // The server-resolved seed: no flash from 256px to 64px on load.
    renderShell(true)
    expect(rail()).toHaveAttribute("data-collapsed", "true")
    expect(screen.getByRole("button", { name: "Mở rộng thanh bên" })).toBeTruthy()
  })

  it("collapses on click and renames the toggle", async () => {
    const user = userEvent.setup()
    renderShell(false)
    await user.click(screen.getByRole("button", { name: "Thu gọn thanh bên" }))

    expect(rail()).toHaveAttribute("data-collapsed", "true")
    expect(screen.getByRole("button", { name: "Mở rộng thanh bên" })).toBeTruthy()
  })

  it("persists the choice without refreshing the route", async () => {
    // Pins the no-refresh decision: the theme provider DOES refresh, and
    // copying its `.then(() => router.refresh())` here would re-run the
    // layout's account and tier queries on every click of a chrome toggle.
    const user = userEvent.setup()
    renderShell(false)
    await user.click(screen.getByRole("button", { name: "Thu gọn thanh bên" }))

    expect(setSidebarCollapsed).toHaveBeenCalledExactlyOnceWith(true)
    expect(route.refresh).not.toHaveBeenCalled()
  })

  it("keeps the footer slot mounted while collapsed", async () => {
    // The footer holds server-action forms. Hiding it with CSS is cosmetic;
    // swapping that for `{!collapsed && footer}` would unmount them and turn a
    // presentation toggle into a functional one.
    const user = userEvent.setup()
    renderShell(false)
    await user.click(screen.getByRole("button", { name: "Thu gọn thanh bên" }))

    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeTruthy()
    // And the rail's own links keep their names — see portal-nav.test.tsx.
    expect(screen.getByRole("link", { name: "Hạng" })).toBeTruthy()
  })

  it("keeps the pinned CTA named, and titles it only once collapsed", async () => {
    // Same rule as the rail's nav links: the label goes `sr-only`, NEVER
    // `hidden`, or the link is left a nameless icon. The `title` is the
    // collapsed state's only visible affordance, so it must NOT be there while
    // the label already is — a tooltip repeating a visible label is noise.
    const user = userEvent.setup()
    renderShell(false)

    const expanded = screen.getByRole("link", { name: "Nâng hạng" })
    expect(expanded).not.toHaveAttribute("title")

    await user.click(screen.getByRole("button", { name: "Thu gọn thanh bên" }))

    const collapsed = screen.getByRole("link", { name: "Nâng hạng" })
    expect(collapsed).toHaveAttribute("title", "Nâng hạng")
  })
})
