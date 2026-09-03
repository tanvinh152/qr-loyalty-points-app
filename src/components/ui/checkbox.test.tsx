import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Checkbox } from "./checkbox"

/**
 * Six forms depend on this control and nothing covered it before. It now routes
 * its state through Animate UI's `useControlledState`, so both modes are worth
 * pinning: uncontrolled must keep its own state, and CONTROLLED must render the
 * prop it was handed rather than a local copy of it — the react-hook-form call
 * sites in reward-form, blog-form and settings-form are all controlled, and a
 * checkbox that lags its own prop by a render is the classic symptom.
 */
describe("ui/checkbox", () => {
  it("toggles when uncontrolled", async () => {
    render(<Checkbox aria-label="đồng ý" />)
    const box = screen.getByRole("checkbox", { name: "đồng ý" })

    expect(box).toHaveAttribute("aria-checked", "false")
    await userEvent.click(box)
    expect(box).toHaveAttribute("aria-checked", "true")
  })

  it("reports changes and obeys the prop when controlled", async () => {
    const onCheckedChange = vi.fn()

    function Controlled() {
      const [checked, setChecked] = React.useState(false)
      return (
        <Checkbox
          aria-label="đồng ý"
          checked={checked}
          onCheckedChange={(next) => {
            onCheckedChange(next)
            setChecked(next === true)
          }}
        />
      )
    }

    render(<Controlled />)
    const box = screen.getByRole("checkbox", { name: "đồng ý" })

    await userEvent.click(box)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(box).toHaveAttribute("aria-checked", "true")

    await userEvent.click(box)
    expect(onCheckedChange).toHaveBeenLastCalledWith(false)
    expect(box).toHaveAttribute("aria-checked", "false")
  })

  it("stays put when a controlled owner refuses the change", async () => {
    // The prop is the single source of truth: an owner that ignores the change
    // must leave the box unchecked, not have it drift on local state.
    render(
      <Checkbox aria-label="khoá" checked={false} onCheckedChange={() => {}} />,
    )
    const box = screen.getByRole("checkbox", { name: "khoá" })

    await userEvent.click(box)
    expect(box).toHaveAttribute("aria-checked", "false")
  })
})
