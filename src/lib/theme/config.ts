// Theme config: cookie-driven light/dark, mirroring the i18n stack
// (src/lib/i18n/config.ts). Unlike the locale, the theme has THREE states from
// the reader's point of view — "light", "dark", or *undecided*. Undecided means
// no explicit choice and no age-seed, so the client falls back to the OS
// `prefers-color-scheme` (see provider.tsx + globals.css). The cookie itself
// only ever holds "light" or "dark"; its ABSENCE is the undecided state.

export const themes = ["light", "dark"] as const
export type Theme = (typeof themes)[number]

export const THEME_COOKIE = "theme"

// One year: a manual toggle (or age-seed) should outlive the session, so a
// returning member keeps their theme without re-deriving it every login.
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Age at or above which light is the default theme (per the product rule).
export const LIGHT_THEME_MIN_AGE = 30

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (themes as readonly string[]).includes(value)
}

// Whole years from a `YYYY-MM-DD` date of birth. `now` is injectable so the age
// rule is testable without freezing the clock.
export function ageFromDob(dob: string, now: Date = new Date()): number {
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return NaN
  let age = now.getFullYear() - birth.getFullYear()
  const monthDelta = now.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

// The age default: 30+ gets light, everyone else (and an unknown/invalid DOB)
// gets dark. This is only the SEED — a later manual toggle overrides it.
export function themeForDob(dob: string | null, now: Date = new Date()): Theme {
  if (!dob) return "dark"
  const age = ageFromDob(dob, now)
  return Number.isFinite(age) && age >= LIGHT_THEME_MIN_AGE ? "light" : "dark"
}
