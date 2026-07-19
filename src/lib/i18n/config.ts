// i18n config: cookie-driven locale, Vietnamese default. No URL routing, no
// visible switcher — the toggle is intentionally hidden. Change the cookie
// `NEXT_LOCALE` to switch languages (see setLocale in ./server).

export const locales = ["vi", "en"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "vi"

export const LOCALE_COOKIE = "NEXT_LOCALE"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
}
