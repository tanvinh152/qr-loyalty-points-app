import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithProviders } from "@/test/render"
import { AccountMenu } from "./account-menu"

// The customer sign-out is "use server" and pulls the Supabase server client,
// which cannot load in jsdom. Mocked per-file rather than in setup.ts because
// this is the only component test that imports it.
vi.mock("@/app/(customer)/auth/actions", () => ({ signOut: vi.fn() }))

/** Everything the phone header has no room for, in sheet order. */
const ENTRIES = ["Nâng hạng", "Hồ sơ", "Hỗ trợ", "Đăng xuất"]

describe("AccountMenu", () => {
  it("keeps the sheet shut until the avatar is pressed", () => {
    renderWithProviders(<AccountMenu name="Lê Tấn Vinh" />)
    expect(screen.queryByText("Nâng hạng")).toBeNull()
    expect(
      screen.getByRole("button", { name: "Tài khoản của bạn" }),
    ).toBeTruthy()
  })

  it("opens onto every action the phone header dropped", async () => {
    // These five are the whole reason the sheet exists: below md the header
    // cannot fit the upgrade CTA, the theme switch and sign-out as controls.
    const user = userEvent.setup()
    renderWithProviders(<AccountMenu name="Lê Tấn Vinh" />)
    await user.click(screen.getByRole("button", { name: "Tài khoản của bạn" }))

    for (const label of ENTRIES) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    // The theme switch names the theme it will move TO, so it is found by role.
    expect(
      screen.getByRole("button", { name: "Chuyển sang giao diện tối" }),
    ).toBeTruthy()
  })

  it("closes when a destination is chosen", async () => {
    // A Link inside the sheet changes the route without unmounting the layout,
    // so nothing closes the sheet for us — it would sit over the page the
    // member just asked for.
    const user = userEvent.setup()
    renderWithProviders(<AccountMenu name="Lê Tấn Vinh" />)
    await user.click(screen.getByRole("button", { name: "Tài khoản của bạn" }))
    await user.click(screen.getByRole("link", { name: "Nâng hạng" }))

    // Asserted on the state attribute, not on unmounting: Base UI keeps the
    // popup mounted through its exit transition, and a CSS transition never
    // finishes in jsdom, so it would still be in the DOM either way.
    expect(
      document.querySelector("[data-slot='drawer-content']"),
    ).toHaveAttribute("data-closed")
  })
})
