import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

import { resetRoute } from "./route"

// Testing Library registers its own afterEach(cleanup) only when `afterEach` is
// a global. This project runs with `globals: false` — every test imports from
// "vitest" explicitly — so that registration never happens and renders would
// pile up inside one file until getByRole starts finding two of everything.
// Base UI portals make it worse: they mount into document.body, outside the
// render container, so only a real unmount clears them.
afterEach(() => {
  cleanup()
  resetRoute()
})

// jsdom implements none of the five below. These are assigned directly rather
// than through vi.stubGlobal because `unstubGlobals: true` runs
// vi.unstubAllGlobals() BEFORE EACH TEST — a stub set here would be torn out
// before the first test ever ran. They are permanent polyfills; the config flag
// stays on so that a per-test vi.stubGlobal still cleans itself up.
//
// matchMedia is load-bearing rather than cosmetic: ThemeProvider subscribes to
// `(prefers-color-scheme: dark)` through useSyncExternalStore whenever the
// server passed no theme cookie. IntersectionObserver is what next/link uses to
// decide when to prefetch, so every link in the tree needs it. The rest is what
// Base UI reaches for while positioning a popup.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

Object.assign(globalThis, {
  ResizeObserver: NoopObserver,
  IntersectionObserver: NoopObserver,
  matchMedia: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

Element.prototype.scrollIntoView = vi.fn()
Element.prototype.getAnimations = () => []

// Both modules below are server-boundary code that cannot load in jsdom, and no
// component test wants the real thing. `next/navigation` has no router outside a
// Next render; `theme/actions` is "use server" and pulls next/headers, which
// drags a large slice of the Next server runtime in behind it. The async factory
// plus dynamic import keeps vi.mock hoisting from stranding the shared `route`.
vi.mock("next/navigation", async () => {
  const { route } = await import("./route")
  return {
    useRouter: () => route,
    usePathname: () => route.pathname,
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    useSelectedLayoutSegment: () => null,
    redirect: vi.fn(),
    notFound: vi.fn(),
  }
})

vi.mock("@/lib/theme/actions", () => ({
  setThemeCookie: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/sidebar/actions", () => ({
  setSidebarCollapsed: vi.fn().mockResolvedValue(undefined),
}))
