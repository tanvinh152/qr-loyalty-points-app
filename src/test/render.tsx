import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

import type { Locale } from "@/lib/i18n/config"
import { I18nProvider } from "@/lib/i18n/provider"
import { MotionProvider } from "@/lib/motion/provider"
import type { Theme } from "@/lib/theme/config"
import { ThemeProvider } from "@/lib/theme/provider"

type Options = Omit<RenderOptions, "wrapper"> & {
  /** Selects the real catalog, not a stub — assertions read the shipped copy. */
  locale?: Locale
  /**
   * Passed straight to `<ThemeProvider initial>`. Keep it non-null unless the
   * test is specifically about the undecided case: `null` means "the server had
   * no cookie", which is what makes the provider subscribe to matchMedia.
   */
  theme?: Theme | null
}

/**
 * Renders a client component under the three contexts the app's client tree
 * always has. Anything reaching for `useT()` or `useTheme()` throws without
 * them.
 *
 * `MotionProvider` is here for what it REJECTS, not what it enables: it mounts
 * `LazyMotion … strict`, so a component that reached for `motion.div` instead
 * of `m.div` — the mistake every vendored Animate UI file starts out making —
 * throws inside the test rather than in someone's browser. `menu.test.tsx` and
 * `truncated-text.test.tsx` deliberately render outside it, proving the popups
 * still degrade gracefully with no Motion features loaded at all.
 *
 * Deliberately does not re-export the rest of Testing Library: this project
 * imports test helpers explicitly, so tests take `screen` and `waitFor` straight
 * from `@testing-library/react`.
 */
export function renderWithProviders(
  ui: ReactElement,
  { locale = "vi", theme = "light", ...options }: Options = {},
): RenderResult {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <I18nProvider locale={locale}>
        <ThemeProvider initial={theme}>
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
      </I18nProvider>
    )
  }

  return render(ui, { wrapper: Providers, ...options })
}
