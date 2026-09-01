import { test, expect } from "@playwright/test"

import { MEMBER_B, UNKNOWN_PHONE } from "./fixtures/accounts"
import { clickStable } from "./fixtures/hydration"
import { clearRateLimits } from "./fixtures/db"

// C-LOG. Auth is phone + password, but Supabase Auth is email-keyed: `signIn`
// resolves phone -> customers.email before it can call signInWithPassword. That
// indirection is invisible to the member and is exactly the sort of thing that
// breaks without anyone noticing until nobody can log in.
//
// Runs as MEMBER_B, not MEMBER, for one reason: `signOut` calls
// `supabase.auth.signOut()` with its default GLOBAL scope, which revokes every
// refresh token the user holds — including the one saved in
// `e2e/.auth/member.json`. Signing out here as MEMBER would silently log the
// whole `member` project out mid-run.

// Each case here burns one or two failed attempts against the runner's IP, and
// the throttle window is fifteen minutes. Reset before every test or the last
// cases in the file are refused for the wrong reason.
test.beforeEach(async () => {
  await clearRateLimits()
})

/**
 * The form's own error banner (`FormError` -> `ui/alert`).
 *
 * NOT `getByRole("alert")`: Next renders `#__next-route-announcer__` with the
 * same role and no text, so a role lookup is ambiguous and, worse, silently
 * resolves to the empty one under `.first()`.
 */
const errorBanner = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="alert"]')

async function submitLogin(page: import("@playwright/test").Page, phone: string, password: string) {
  await page.goto("/login")
  await page.locator("#phone").fill(phone)
  await page.locator("#password").fill(password)
  await page.getByRole("button", { name: /đăng nhập/i }).click()
}

test("a member signs in with their phone number", async ({ page }) => {
  await submitLogin(page, MEMBER_B.phone, MEMBER_B.password)

  await page.waitForURL("**/dashboard")
  await expect(page.getByRole("main")).toBeVisible()
})

test("a wrong password is refused", async ({ page }) => {
  await submitLogin(page, MEMBER_B.phone, "definitely-not-the-password")

  await expect(page).toHaveURL(/\/login/)
  await expect(errorBanner(page)).toBeVisible()
})

// The two failures MUST read identically. A distinct "no such account" would
// turn the login form into a free membership-list oracle for anyone holding a
// list of Vietnamese phone numbers.
test("an unregistered phone is indistinguishable from a wrong password", async ({
  page,
}) => {
  const alert = errorBanner(page)

  // textContent, not innerText: the banner animates in, and innerText is
  // CSS-aware enough to answer "" for text that is present but not yet painted.
  async function messageAfter(phone: string) {
    await submitLogin(page, phone, "definitely-not-the-password")
    await expect(alert).toHaveText(/\S/)
    return (await alert.textContent())!.trim()
  }

  const wrongPassword = await messageAfter(MEMBER_B.phone)
  const unknownPhone = await messageAfter(UNKNOWN_PHONE)

  expect(unknownPhone).toBe(wrongPassword)
})

test("signing out closes the account area behind you", async ({ page }) => {
  await submitLogin(page, MEMBER_B.phone, MEMBER_B.password)
  await page.waitForURL("**/dashboard")

  // Everything about the account hides behind the avatar at every width: the
  // identity block IS the trigger, and sign-out is a row inside its menu.
  const signOut = page.getByRole("menuitem", { name: /đăng xuất/i })
  await clickStable(page.getByRole("button", { name: /tài khoản/i }), signOut)
  await signOut.click()

  await page.waitForURL(/\/login/)

  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/login$/)
})
