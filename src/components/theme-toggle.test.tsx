import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { setThemeCookie } from "@/lib/theme/actions"
import { renderWithProviders } from "@/test/render"
import { route } from "@/test/route"
import { ThemeToggle } from "./theme-toggle"

// Mocked globally in src/test/setup.ts — "use server" + next/headers cannot load
// in jsdom.
const setCookie = vi.mocked(setThemeCookie)

beforeEach(() => {
  setCookie.mockClear()
  document.documentElement.removeAttribute("data-theme")
})

describe("ThemeToggle", () => {
  it("advertises the theme it will switch TO, not the current one", () => {
    // The convention the component's comment describes: a sun while dark, a moon
    // while light. Inverting it is invisible to types and to a snapshot.
    renderWithProviders(<ThemeToggle />, { locale: "en", theme: "dark" })
    expect(
      screen.getByRole("button", { name: "Switch to light theme" }),
    ).toBeInTheDocument()
  })

  it("advertises the dark switch while light", () => {
    renderWithProviders(<ThemeToggle />, { locale: "en", theme: "light" })
    expect(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeInTheDocument()
  })

  it("persists the opposite theme and refreshes", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeToggle />, { locale: "en", theme: "light" })

    await user.click(screen.getByRole("button"))

    expect(setCookie).toHaveBeenCalledExactlyOnceWith("dark")
    await waitFor(() => expect(route.refresh).toHaveBeenCalled())
  })

  it("flips the document immediately, before the cookie round-trip", async () => {
    // The "instant feedback" path: the cookie plus a refresh are what make it
    // stick, but the attribute must not wait for them.
    const user = userEvent.setup()
    renderWithProviders(<ThemeToggle />, { locale: "en", theme: "dark" })

    await user.click(screen.getByRole("button"))

    expect(document.documentElement.dataset.theme).toBe("light")
  })

  it("relabels after toggling, without waiting for the server", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeToggle />, { locale: "en", theme: "light" })

    await user.click(screen.getByRole("button"))

    expect(
      await screen.findByRole("button", { name: "Switch to light theme" }),
    ).toBeInTheDocument()
  })

  it("keeps the accessible name but drops the visible label when icon-only", () => {
    renderWithProviders(<ThemeToggle iconOnly />, {
      locale: "en",
      theme: "light",
    })
    const button = screen.getByRole("button", { name: "Switch to dark theme" })
    expect(button).toHaveTextContent("")
  })

  it("renders the visible label in the active locale", () => {
    // Also proves renderWithProviders really swaps catalogs rather than always
    // handing back the default.
    renderWithProviders(<ThemeToggle />, { locale: "vi", theme: "dark" })
    expect(
      screen.getByRole("button", { name: "Chuyển sang giao diện sáng" }),
    ).toHaveTextContent("Sáng")
  })
})
