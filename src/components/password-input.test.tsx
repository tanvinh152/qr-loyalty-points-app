import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"
import { PasswordInput } from "./password-input"

describe("PasswordInput", () => {
  it("hides the value until the toggle is pressed, and says which way it is", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <PasswordInput
        id="password"
        name="password"
        showLabel="Show password"
        hideLabel="Hide password"
      />,
    )
    const field = document.getElementById("password") as HTMLInputElement
    expect(field.type).toBe("password")

    const toggle = screen.getByRole("button", { name: "Show password" })
    expect(toggle).toHaveAttribute("aria-pressed", "false")
    await user.click(toggle)

    expect(field.type).toBe("text")
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true")
  })

  // The toggle sits inside a <form>; a submit default would post it.
  it("never submits the form it sits in", () => {
    renderWithProviders(
      <PasswordInput id="p" name="p" showLabel="show" hideLabel="hide" />,
    )
    expect(screen.getByRole("button")).toHaveAttribute("type", "button")
  })
})
