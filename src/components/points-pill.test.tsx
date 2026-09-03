import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PointsPill } from "./points-pill"

// MotionGlobalConfig.skipAnimations (src/test/setup.ts) sends every animation
// straight to its end frame, so what these assert is the START and END state,
// not the tween.

describe("PointsPill", () => {
  it("formats with the locale it is given, not the runner's", () => {
    // The pill used to be server-rendered with a bare toLocaleString(). Once it
    // became a client component, a server/browser disagreement over the group
    // separator became a hydration mismatch — hence the explicit locale.
    const { container } = render(
      <PointsPill value={1250} unit="điểm" locale="vi-VN" />,
    )
    expect(container.textContent).toContain("1.250")

    const en = render(<PointsPill value={1250} unit="points" locale="en-US" />)
    expect(en.container.textContent).toContain("1,250")
  })

  it("announces the balance once, in full, with its unit", () => {
    render(<PointsPill value={1250} unit="điểm" locale="vi-VN" />)
    // The digits animate; a screen reader must hear the settled figure once
    // rather than every intermediate number.
    expect(screen.getByRole("status")).toHaveTextContent("1.250 điểm")
  })

  it("shows the value on mount without counting up to it", () => {
    // `previous` is seeded with the incoming value so from === to on first
    // paint. Every route change re-renders this layout — a count-up on each
    // one would be noise.
    const { container } = render(
      <PointsPill value={9999} unit="điểm" locale="vi-VN" />,
    )
    expect(container.textContent).toContain("9.999")
  })

  it("re-renders to the new balance when it changes", () => {
    const { rerender, container } = render(
      <PointsPill value={100} unit="điểm" locale="vi-VN" />,
    )
    rerender(<PointsPill value={340} unit="điểm" locale="vi-VN" />)
    expect(screen.getByRole("status")).toHaveTextContent("340 điểm")
    expect(container.textContent).toContain("340")
  })
})
