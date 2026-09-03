import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Progress } from "./progress"

/**
 * Callers pass 0–1, Radix scores against `max=100`. The conversion between them
 * is invisible to TypeScript — both sides are `number` — so losing it would put
 * every bar in the app at ~1% with nothing failing. Six pages depend on it and
 * none of them had a test.
 */
describe("ui/progress", () => {
  it("scales a 0–1 value onto the 0–100 the ARIA contract reports", () => {
    render(<Progress value={0.42} label="tiến độ" />)

    const bar = screen.getByRole("progressbar", { name: "tiến độ" })
    expect(bar).toHaveAttribute("aria-valuenow", "42")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
  })

  it("clamps out-of-range values instead of overflowing the track", () => {
    const { rerender } = render(<Progress value={1.8} label="tràn" />)
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    )

    rerender(<Progress value={-0.5} label="tràn" />)
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    )
  })
})
