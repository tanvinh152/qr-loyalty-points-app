import { vi } from "vitest"

/**
 * Stand-in for Next's client router. `next/navigation` only works inside a Next
 * render, so `src/test/setup.ts` mocks the whole module against this object.
 *
 * A test that cares about the current path assigns `route.pathname` before
 * rendering; one that asserts navigation reads the spies directly.
 */
export const route = {
  pathname: "/",
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
  refresh: vi.fn(),
}

/** Put the router back to its default between tests. */
export function resetRoute() {
  route.pathname = "/"
  for (const value of Object.values(route)) {
    if (typeof value === "function") vi.mocked(value).mockClear()
  }
}
