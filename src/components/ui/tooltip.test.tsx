import { render, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip"

/**
 * The popup's presence is Motion's job now, not CSS's: Animate UI's
 * TooltipPortal renders inside <AnimatePresence>, which holds a closed popup in
 * the DOM until its exit animation finishes. If that exit never completes — the
 * failure mode when `MotionGlobalConfig.skipAnimations` stops being set in
 * src/test/setup.ts, or when a future primitive forgets its `exit` — the popup
 * stays mounted forever and every "is it gone" assertion in the suite silently
 * inverts.
 *
 * Driven by the `open` prop rather than by hovering: Radix's tooltip does not
 * close on `userEvent.unhover()` under jsdom (verified against plain Radix with
 * no Animate UI in the tree), so a hover-driven test would fail for a reason
 * that has nothing to do with this file.
 */
function Fixture({ open }: { open: boolean }) {
  return (
    <TooltipProvider delay={0}>
      <Tooltip open={open}>
        <TooltipTrigger>trigger</TooltipTrigger>
        <TooltipContent>revealed</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const popup = () => document.querySelector('[data-slot="tooltip-content"]')

describe("ui/tooltip", () => {
  it("mounts the popup on open and removes it on close", async () => {
    const { rerender } = render(<Fixture open />)
    await waitFor(() => expect(popup()).toHaveTextContent("revealed"))

    rerender(<Fixture open={false} />)
    await waitFor(() => expect(popup()).toBeNull())
  })
})
