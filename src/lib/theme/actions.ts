"use server"

import { cookies } from "next/headers"

import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type Theme,
} from "./config"

// Persist an explicit theme choice. Called by the toggle (client) and by the
// auth actions to seed the age default. Setting the cookie is the whole job —
// the caller decides whether to redirect or refresh afterwards.
export async function setThemeCookie(theme: Theme): Promise<void> {
  ;(await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
  })
}
