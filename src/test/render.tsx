import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

import type { Locale } from "@/lib/i18n/config"
import { I18nProvider } from "@/lib/i18n/provider"
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
 * Renders a client component under the two contexts the app's client tree always
 * has. Anything reaching for `useT()` or `useTheme()` throws without them.
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
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </I18nProvider>
    )
  }

  return render(ui, { wrapper: Providers, ...options })
}
