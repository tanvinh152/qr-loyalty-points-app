// Sidebar collapse config: cookie-driven, mirroring src/lib/theme/. Unlike the
// theme this has only TWO states, so there is no `isTheme` equivalent to look
// for — the cookie holds the literal string "1" when collapsed, and its ABSENCE
// is the expanded default. `setSidebarCollapsed` deletes it rather than writing
// "0", so a fresh browser and a deliberately-expanded one look identical.
//
// ONE cookie for BOTH portals (path "/"): an admin session and a customer
// session are different humans on different machines in practice, and sharing
// the preference is the friendlier behaviour when they are not. Don't split it
// per portal without a reason.

export const SIDEBAR_COOKIE = "sidebar_collapsed"

// One year, matching THEME_COOKIE_MAX_AGE: a chrome preference should outlive
// the session.
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
