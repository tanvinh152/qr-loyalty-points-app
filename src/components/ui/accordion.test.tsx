import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion"

/**
 * /faq gave up a native <details>/<summary> for this, so the two things
 * <summary> did for free are what get pinned: the answer must not be reachable
 * until asked for, and the control must actually announce its state. A
 * <summary> was only ever implicitly expandable; this reports aria-expanded.
 */
function Fixture() {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="q1">
        <AccordionTrigger>Điểm có hết hạn không?</AccordionTrigger>
        <AccordionContent>Điểm không hết hạn.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

describe("ui/accordion", () => {
  it("keeps the answer out of the DOM until the question is opened", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    const trigger = screen.getByRole("button", {
      name: "Điểm có hết hạn không?",
    })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Điểm không hết hạn.")).toBeNull()

    await user.click(trigger)
    await waitFor(() =>
      expect(screen.getByText("Điểm không hết hạn.")).toBeInTheDocument(),
    )
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("collapses again on a second press", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    const trigger = screen.getByRole("button", {
      name: "Điểm có hết hạn không?",
    })
    await user.click(trigger)
    await waitFor(() =>
      expect(screen.getByText("Điểm không hết hạn.")).toBeInTheDocument(),
    )

    await user.click(trigger)
    await waitFor(() =>
      expect(screen.queryByText("Điểm không hết hạn.")).toBeNull(),
    )
  })
})
