import { Suspense } from "react"
import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Slot } from "./slot"

// What this file guards is the ONE case `isValidElement` gets wrong.
//
// A server component's JSX does not reach a client component as an element:
// React outlines a large enough prop into its own Flight chunk and passes a
// `Symbol(react.lazy)` wrapper instead, which is exactly the object
// `React.lazy()` returns. `ui/input.tsx` and `page-link.tsx` are both server
// components handing a Slot its child, so both go through this path — and
// whether a given call site does is a SIZE heuristic, not something the call
// site controls. Bailing to `null` there rendered nothing on the server and the
// real element in the browser, which is a hydration mismatch on any page
// carrying a search field.
function lazyChild(element: React.ReactElement) {
  // `React.lazy` builds the same `{ $$typeof, _payload, _init }` shape Flight
  // hands over; resolving to an element rather than a component type is what
  // makes it stand in for an outlined prop. React renders that object happily —
  // only the types insist a lazy node is a component, which is why this is cast.
  return React.lazy(
    async () => ({ default: element }) as never,
  ) as unknown as React.ReactNode
}

describe("Slot", () => {
  it("renders a child it cannot introspect", async () => {
    render(
      <Suspense fallback={null}>
        <Slot>{lazyChild(<div data-testid="child">nội dung</div>)}</Slot>
      </Suspense>,
    )

    await waitFor(() => expect(screen.getByTestId("child")).toBeVisible())
  })

  it("still merges its own props onto a plain element child", () => {
    render(
      <Slot className="wrapper" data-testid="merged">
        <div className="relative">nội dung</div>
      </Slot>,
    )

    expect(screen.getByTestId("merged")).toHaveClass("relative", "wrapper")
  })
})
