import { test, expect } from "@playwright/test"

// S-AUTH-01, S-AUTH-04..07. The proxy guard (src/lib/supabase/middleware.ts) is
// unit-tested against a mocked Supabase; this is the same matrix through the
// real edge, with a real (absent) session. What it adds over the unit test is
// that the guard is actually WIRED UP — src/proxy.ts's matcher has to run on
// these paths for any of it to matter.

const ADMIN_ROUTES = ["/admin", "/admin/customers", "/admin/tiers", "/admin/rewards"]

// Every segment of (customer)/(account) that has a page. The unit test derives
// this list from disk; here it is spelled out so a mismatch between the two is
// visible in review.
const ACCOUNT_ROUTES = [
  "/dashboard",
  "/rewards",
  "/rewards/roadmap",
  "/tiers",
  "/history",
  "/help",
  "/profile",
]

// "/" is deliberately NOT here: it is where the QR on the parcel lands and it
// redirects straight to /login, because /login already links to /register and a
// live session is bounced to /dashboard before the form renders.
const PUBLIC_ROUTES = ["/faq", "/terms", "/blog"]

test.describe("an anonymous visitor", () => {
  for (const route of ADMIN_ROUTES) {
    test(`is sent from ${route} to the staff login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/admin\/login$/)
    })
  }

  for (const route of ACCOUNT_ROUTES) {
    test(`is sent from ${route} to the member login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login$/)
    })
  }

  // /register links to /terms, so gating the public pages would bounce an
  // anonymous signer-up to /login and strand them.
  for (const route of PUBLIC_ROUTES) {
    test(`may still read ${route}`, async ({ page }) => {
      await page.goto(route)
      await expect(page).not.toHaveURL(/\/login/)
    })
  }
})
