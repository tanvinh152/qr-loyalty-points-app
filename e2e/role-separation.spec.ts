import { test, expect } from "@playwright/test"

import { MEMBER, MEMBER_B } from "./fixtures/accounts"

// S-AUTH-02, S-AUTH-08 and C-HIS-05, all running as a signed-in MEMBER.
//
// This is the file that earns E2E its place: it is the only test anywhere that
// exercises the proxy guard, the JWT app_metadata claim and Postgres RLS
// together, against one real session. Each of the three is covered on its own
// elsewhere; nothing else proves they line up.

test("a member is pushed out of the admin portal", async ({ page }) => {
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("a member cannot open another member's admin record", async ({ page }) => {
  await page.goto(`/admin/customers/${MEMBER_B.id}`)

  await expect(page).toHaveURL(/\/dashboard$/)
  // Belt and braces: the redirect could in principle happen after a render.
  await expect(page.locator("body")).not.toContainText(MEMBER_B.phone)
  await expect(page.locator("body")).not.toContainText(MEMBER_B.fullName)
})

test("a member's history holds none of another member's rows", async ({ page }) => {
  await page.goto("/history")

  const body = page.locator("body")
  await expect(body).not.toContainText("E2E marker for member B")
  await expect(body).not.toContainText(MEMBER_B.phone)
})

test("the member portal renders for its owner", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText(MEMBER.fullName).first()).toBeVisible()
})
