import Link from "next/link"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { TruncatedText } from "./truncated-text"

const LONG =
  "Trà sữa trân châu đường đen size L thêm kem cheese và thạch phô mai nướng"

// jsdom lays nothing out, so scrollHeight/clientHeight are both 0 and the
// component would always read "fits". These stubs are the measurement.
function stubLayout({ scroll, client }: { scroll: number; client: number }) {
  for (const [prop, value] of [
    ["scrollHeight", scroll],
    ["clientHeight", client],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      value,
    })
  }
}

afterEach(() => {
  for (const prop of ["scrollHeight", "clientHeight"] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      value: 0,
    })
  }
})

function renderClamped(ui: React.ReactElement) {
  return render(<TooltipProvider delay={0}>{ui}</TooltipProvider>)
}

/**
 * Base UI's tooltip popup carries no `role`, so the data-slot the wrapper in
 * `ui/tooltip.tsx` stamps on it is what identifies it.
 */
function popup() {
  return document.querySelector('[data-slot="tooltip-content"]')
}

describe("TruncatedText", () => {
  it("leaves text that fits alone", async () => {
    stubLayout({ scroll: 20, client: 20 })
    renderClamped(<TruncatedText>Trà sữa</TruncatedText>)

    const span = screen.getByText("Trà sữa")
    // No hover target and no tab stop: the 90% of rows that are short must not
    // sprout a tooltip.
    expect(span).not.toHaveAttribute("tabindex")

    await userEvent.hover(span)
    expect(popup()).toBeNull()
  })

  it("reveals clipped text in a tooltip", async () => {
    stubLayout({ scroll: 60, client: 40 })
    renderClamped(<TruncatedText>{LONG}</TruncatedText>)

    const span = screen.getByText(LONG)
    expect(span).toHaveAttribute("tabindex", "0")

    await userEvent.hover(span)
    await waitFor(() => expect(popup()).toHaveTextContent(LONG))
  })

  it("takes the tooltip text from the prop when the child is a node", async () => {
    stubLayout({ scroll: 60, client: 40 })
    renderClamped(
      <TruncatedText tooltip={LONG} focusable={false}>
        <Link href="/admin/customers/1">{LONG}</Link>
      </TruncatedText>,
    )

    // focusable={false} because the child link is already a tab stop — one cell
    // must not take two.
    expect(screen.getByRole("link")).toBeInTheDocument()
    expect(screen.getByRole("link").parentElement).not.toHaveAttribute(
      "tabindex",
    )

    await userEvent.hover(screen.getByRole("link"))
    await waitFor(() => expect(popup()).toHaveTextContent(LONG))
  })
})
