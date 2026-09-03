import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Button } from "./button"

// The whole of this file guards one thing the type checker cannot see. Button
// was built on Base UI, whose primitive defaulted to type="button". A bare
// <button> defaults to type="submit", so the Radix rewrite would have turned
// every unmarked Button inside a <form> into a submit button — 20 call sites,
// no compile error, no existing test.
describe("Button", () => {
  it("defaults to type=button, as the Base UI primitive did", () => {
    render(<Button>Huỷ</Button>)
    expect(screen.getByRole("button", { name: "Huỷ" })).toHaveAttribute(
      "type",
      "button",
    )
  })

  it("still lets a caller ask for a submit button", () => {
    render(<Button type="submit">Lưu</Button>)
    expect(screen.getByRole("button", { name: "Lưu" })).toHaveAttribute(
      "type",
      "submit",
    )
  })

  it("renders the child element under asChild, keeping the variant classes", () => {
    render(
      <Button asChild variant="secondary">
        <a href="/tiers">Nâng hạng</a>
      </Button>,
    )
    const link = screen.getByRole("link", { name: "Nâng hạng" })
    expect(link).toHaveAttribute("data-slot", "button")
    expect(link).toHaveClass("border-primary")
    // A link is not a button and must not be handed a type attribute.
    expect(link).not.toHaveAttribute("type")
  })

  // The small sizes are under the 44px touch minimum. Their hit box grows on
  // a coarse pointer through a ::before — invisible, so only the class proves
  // it is there.
  it.each(["xs", "sm", "icon-xs", "icon-sm"] as const)(
    "widens the %s size's hit box on a coarse pointer",
    (size) => {
      render(<Button size={size}>·</Button>)
      expect(screen.getByRole("button").className).toMatch(
        /pointer-coarse:before:-inset-/,
      )
    },
  )

  it("leaves the default size's hit box alone — it already clears 40px", () => {
    render(<Button>·</Button>)
    expect(screen.getByRole("button").className).not.toMatch(/pointer-coarse/)
  })
})
