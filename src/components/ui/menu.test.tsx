import Link from "next/link"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLinkItem,
  MenuTrigger,
} from "./menu"

// Two contracts this wrapper owns, neither of which the type checker can see.
//
// `closeOnClick` is our own prop, carried over from the Base UI era so the call
// sites did not have to change; it maps to Radix's onSelect + preventDefault.
// It is load-bearing: the sign-out <form> lives INSIDE the popup, so a menu that
// closed on click would unmount the form out from under its own submit.
//
// MenuLinkItem has no Radix counterpart — it is `Item asChild` — and `asChild`
// only works if the caller's children sit inside the child element.

function openMenu(rows: React.ReactNode) {
  render(
    <Menu>
      <MenuTrigger>Tài khoản</MenuTrigger>
      <MenuContent>{rows}</MenuContent>
    </Menu>,
  )
  return userEvent.setup()
}

describe("MenuItem closeOnClick", () => {
  it("keeps the popup mounted when closeOnClick is false", async () => {
    const onClick = vi.fn()
    const user = openMenu(
      <MenuItem closeOnClick={false} onClick={onClick}>
        Đổi giao diện
      </MenuItem>,
    )

    await user.click(screen.getByText("Tài khoản"))
    await user.click(await screen.findByRole("menuitem"))

    expect(onClick).toHaveBeenCalledOnce()
    // Still open: the row acted without dismissing the surface it lives on.
    expect(screen.getByRole("menuitem")).toBeInTheDocument()
  })

  it("closes on click by default", async () => {
    const user = openMenu(<MenuItem>Xem hồ sơ</MenuItem>)

    await user.click(screen.getByText("Tài khoản"))
    await user.click(await screen.findByRole("menuitem"))

    await waitFor(() =>
      expect(screen.queryByRole("menuitem")).not.toBeInTheDocument(),
    )
  })
})

describe("MenuLinkItem", () => {
  it("puts the menuitem role on the caller's own link", async () => {
    const user = openMenu(
      <MenuLinkItem>
        <Link href="/profile">Hồ sơ</Link>
      </MenuLinkItem>,
    )

    await user.click(screen.getByText("Tài khoản"))

    const row = await screen.findByRole("menuitem")
    expect(row.tagName).toBe("A")
    expect(row).toHaveAttribute("href", "/profile")
    // The label has to survive the slot, or the row has no accessible name.
    expect(row).toHaveAccessibleName("Hồ sơ")
  })
})
