import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithProviders } from "@/test/render"
import { route, resetRoute } from "@/test/route"
import type { PortalTitle } from "@/lib/portal-title"
import { PortalHeader } from "./portal-header"
import { SidebarProvider } from "./portal-sidebar"

// The rail's collapse cookie is a server action, which cannot load in jsdom.
vi.mock("@/lib/sidebar/actions", () => ({ setSidebarCollapsed: vi.fn() }))

const TITLES: PortalTitle[] = [
  { href: "/admin", label: "Tổng quan", exact: true },
  { href: "/admin/customers", label: "Khách hàng" },
]

function at(pathname: string) {
  route.pathname = pathname
  renderWithProviders(
    <SidebarProvider initialCollapsed={false}>
      <PortalHeader titles={TITLES} backLabel="Quay lại mục" brand={null} />
    </SidebarProvider>,
  )
}

describe("PortalHeader", () => {
  beforeEach(resetRoute)

  it("names the section you are standing in", () => {
    at("/admin/customers")
    expect(screen.getByRole("heading").textContent).toBe("Khách hàng")
  })

  it("offers no way back from the section's own page", () => {
    at("/admin/customers")
    expect(screen.queryByRole("link", { name: "Quay lại mục" })).toBeNull()
  })

  it("points the back link at the section from a detail route", () => {
    at("/admin/customers/abc-123")
    const back = screen.getByRole("link", { name: "Quay lại mục" })
    expect(back.getAttribute("href")).toBe("/admin/customers")
    // Still the section's name, not the record's — the page's own PageHeader
    // is what says which customer this is.
    expect(screen.getByRole("heading").textContent).toBe("Khách hàng")
  })

  it("says nothing rather than guessing on an unmapped route", () => {
    // /admin/spin/winners is real and has no nav entry. Labelling it with an
    // ancestor's name would tell the reader they are somewhere they are not.
    at("/admin/spin/winners")
    expect(screen.queryByRole("heading")).toBeNull()
  })

  it("only rules off the context group when both groups are there", () => {
    // The divider exists to separate live context from system controls; with
    // one of them absent it would be a stray mark against the edge.
    route.pathname = "/admin"
    const { container } = renderWithProviders(
      <SidebarProvider initialCollapsed={false}>
        <PortalHeader
          titles={TITLES}
          backLabel="Quay lại mục"
          brand={null}
          system={<button type="button">Đăng xuất</button>}
        />
      </SidebarProvider>,
    )
    expect(container.querySelector("span.w-px")).toBeNull()
  })
})
