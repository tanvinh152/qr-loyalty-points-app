import "server-only"

import { cookies } from "next/headers"

import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config"
import { messages, type Messages } from "./messages"

// Resolve the active locale from the cookie, falling back to the default (vi).
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : defaultLocale
}

// Server-side message catalog for the current request. Use in Server
// Components, pages, layouts, generateMetadata, and Server Actions.
export async function getMessages(): Promise<Messages> {
  return messages[await getLocale()]
}
