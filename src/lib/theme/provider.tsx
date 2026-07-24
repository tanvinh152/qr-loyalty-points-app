"use client"

import { createContext, useContext, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"

import { setThemeCookie } from "./actions"
import type { Theme } from "./config"

// Mirrors I18nProvider: the server passes the resolved value across the
// boundary, the client tree reads it through a hook. Here the value can be
// `null` (no cookie) — the OS decides, and the init script (ThemeInitScript)
// has already stamped `data-theme` on <html>. When undecided we subscribe to
// the OS preference so the toggle flips from the real current theme; a manual
// choice overrides it immediately and is persisted via the cookie.

const MEDIA = "(prefers-color-scheme: dark)"

// Read the OS preference reactively, but only when the server was undecided.
// When a cookie exists, `initial` is authoritative and the store is inert.
function useOsOrInitial(initial: Theme | null): Theme {
  return useSyncExternalStore(
    (onChange) => {
      if (initial !== null) return () => {}
      const mq = window.matchMedia(MEDIA)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () =>
      initial ?? (window.matchMedia(MEDIA).matches ? "dark" : "light"),
    () => initial ?? "dark",
  )
}

type ThemeContextValue = {
  theme: Theme
  setTheme: (next: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({
  initial,
  children,
}: {
  initial: Theme | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const base = useOsOrInitial(initial)
  // A manual choice wins until the refresh re-renders with the new cookie value.
  const [override, setOverride] = useState<Theme | null>(null)
  const theme = override ?? base

  const setTheme = (next: Theme) => {
    setOverride(next)
    // Flip immediately for instant feedback; the cookie + refresh make it stick.
    document.documentElement.dataset.theme = next
    void setThemeCookie(next).then(() => router.refresh())
  }

  const value: ThemeContextValue = {
    theme,
    setTheme,
    toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>")
  return ctx
}
