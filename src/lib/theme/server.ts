import "server-only"

import { cookies } from "next/headers"

import { isTheme, THEME_COOKIE, type Theme } from "./config"

// Resolve the explicit theme choice from the cookie. Returns null when nothing
// was chosen or seeded — the *undecided* state, which the client resolves from
// the OS `prefers-color-scheme` (see provider.tsx). Mirrors getLocale().
export async function getTheme(): Promise<Theme | null> {
  const value = (await cookies()).get(THEME_COOKIE)?.value
  return isTheme(value) ? value : null
}
