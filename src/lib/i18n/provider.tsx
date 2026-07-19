"use client"

import { createContext, useContext, useMemo } from "react"

import type { Locale } from "./config"
import { messages, type Messages } from "./messages"

const I18nContext = createContext<Messages | null>(null)

// Wraps the client tree. Only the `locale` string crosses the server/client
// boundary; the catalog itself (which contains functions) is selected here from
// the bundled `messages` map.
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  const value = useMemo(() => messages[locale], [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// Client-side message catalog. Mirrors getMessages() on the server.
export function useT(): Messages {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useT must be used within <I18nProvider>")
  return ctx
}
