import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog"

/**
 * Radix's DismissableLayer parks `pointer-events: none` on <body> while a modal
 * dialog is open and lifts it on unmount. <AnimatePresence> now delays that
 * unmount until the exit animation finishes, so the two have to be checked
 * together: if the restore ever loses the race, the dialog looks closed while
 * the entire page stays dead to clicks, recoverable only by a reload. No test
 * covered this before the Animate UI migration because nothing used to defer
 * the unmount.
 */
function Fixture() {
  return (
    <Dialog>
      <DialogTrigger>open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Xác nhận</DialogTitle>
        <DialogDescription>nội dung</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

const content = () => document.querySelector('[data-slot="dialog-content"]')

describe("ui/dialog", () => {
  it("unmounts and hands the page back on Escape", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(<Fixture />)

    await user.click(screen.getByText("open"))
    await waitFor(() => expect(content()).toBeInTheDocument())

    await user.keyboard("{Escape}")

    await waitFor(() => expect(content()).toBeNull())
    expect(document.body.style.pointerEvents).not.toBe("none")
  })
})
