"use server"

import { cookies } from "next/headers"

import { SIDEBAR_COOKIE, SIDEBAR_COOKIE_MAX_AGE } from "./config"

// Persist the rail's collapsed state. Called fire-and-forget by SidebarToggle:
// unlike setThemeCookie there is deliberately NO router.refresh() afterwards —
// collapsing is pure presentation, nothing server-rendered depends on it, and a
// refresh would re-run getAccount()/getTiers() (customer) or auth.getUser()
// (admin) on every click of a chrome toggle.
export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  const store = await cookies()
  if (collapsed) {
    store.set(SIDEBAR_COOKIE, "1", {
      path: "/",
      maxAge: SIDEBAR_COOKIE_MAX_AGE,
      sameSite: "lax",
    })
  } else {
    // Expanded is the default, so leave no cookie behind.
    store.delete(SIDEBAR_COOKIE)
  }
}
