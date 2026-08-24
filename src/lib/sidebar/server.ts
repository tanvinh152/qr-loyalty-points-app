import "server-only"

import { cookies } from "next/headers"

import { SIDEBAR_COOKIE } from "./config"

// Resolve the rail's collapsed state from the cookie. Read by both portal
// layouts so the server renders the correct WIDTH — a client-only read would
// paint a 256px rail and snap it to 64px after hydration, reflowing <main>.
// Mirrors getTheme() / getLocale(); both layouts are already dynamic because
// getMessages() reads cookies, so this costs nothing extra.
export async function getSidebarCollapsed(): Promise<boolean> {
  return (await cookies()).get(SIDEBAR_COOKIE)?.value === "1"
}
