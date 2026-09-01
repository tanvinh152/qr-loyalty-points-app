import { test as setup, expect } from "@playwright/test"

import { ADMIN, MEMBER, STORAGE } from "./fixtures/accounts"

/**
 * Signs both roles in THROUGH THE REAL FORMS and saves the resulting cookies.
 *
 * Not by minting a Supabase session cookie by hand, for two reasons. The cookie
 * is `@supabase/ssr`'s chunked, base64-prefixed format — hand-minting it would
 * test our guess at that encoding rather than the app's, and would rot silently
 * on the next `@supabase/ssr` bump. And signing in IS a P0 case (C-LOG-01): the
 * app's auth is phone + password while Supabase Auth is email-keyed, so `signIn`
 * has to resolve phone -> `customers.email` before it can call
 * `signInWithPassword`. Driving the form makes this step earn its keep, and if
 * it breaks every project fails at the dependency rather than halfway through a
 * spec with a confusing redirect.
 */

// The password field is addressed by id, not by label: its `<label>` text also
// matches the show/hide toggle sitting inside the same field, and a label lookup
// is ambiguous between the two.
setup("sign in as a member", async ({ page }) => {
  await page.goto("/login")
  await page.locator("#phone").fill(MEMBER.phone)
  await page.locator("#password").fill(MEMBER.password)
  await page.getByRole("button", { name: /đăng nhập/i }).click()

  await page.waitForURL("**/dashboard")
  await page.context().storageState({ path: STORAGE.member })
})

setup("sign in as an admin", async ({ page }) => {
  await page.goto("/admin/login")
  await page.locator("#email").fill(ADMIN.email)
  await page.locator("#password").fill(ADMIN.password)
  await page.getByRole("button", { name: /đăng nhập/i }).click()

  await page.waitForURL(/\/admin(\/|$)/)
  await expect(page).not.toHaveURL(/\/admin\/login/)
  await page.context().storageState({ path: STORAGE.admin })
})
