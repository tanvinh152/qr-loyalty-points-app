import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"
import { Celebration } from "./celebration"

describe("Celebration", () => {
  it("renders the glyph and nothing decorative until fired", () => {
    renderWithProviders(
      <Celebration fire={false}>
        <span data-testid="glyph" />
      </Celebration>,
    )
    expect(screen.getByTestId("glyph")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="celebration-burst"]')).toBeNull()
  })

  it("plays a burst hidden from assistive tech once fired", () => {
    const { rerender } = renderWithProviders(
      <Celebration fire={false}>
        <span data-testid="glyph" />
      </Celebration>,
    )
    rerender(
      <Celebration fire>
        <span data-testid="glyph" />
      </Celebration>,
    )
    const burst = document.querySelector('[data-slot="celebration-burst"]')
    expect(burst).not.toBeNull()
    expect(burst).toHaveAttribute("aria-hidden")
    // The glyph survives the burst — it is the thing being celebrated.
    expect(screen.getByTestId("glyph")).toBeInTheDocument()
  })
})
