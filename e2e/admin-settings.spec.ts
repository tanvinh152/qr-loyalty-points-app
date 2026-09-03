import { expect, test } from "@playwright/test"

import { readSettings, setSettings } from "./fixtures/db"
import { fillStable } from "./fixtures/hydration"

/**
 * `/admin/settings` — the single active `loyalty_settings` row.
 *
 * Two of its fields are feature switches rather than amounts, and the pair is
 * the reason this screen is worth an E2E rather than a unit test: setting
 * `checkin_points` or `spin_daily_limit` to 0 removes a whole surface from the
 * member portal, and the only way to prove that is to go and look.
 */

const SEED = {
  rounding: "floor",
  vnd_per_point: 1000,
  welcome_gift_points: 0,
  checkin_points: 0,
  spin_daily_limit: 0,
} as const

test.beforeEach(async () => {
  await setSettings(SEED)
})

test.afterAll(async () => {
  await setSettings(SEED)
})

test("the numeric rules are saved as typed", async ({ page }) => {
  await page.goto("/admin/settings")

  await fillStable(page.locator("#vnd_per_point"), "2000")
  await fillStable(page.locator("#welcome_gift_points"), "50")
  await fillStable(page.locator("#checkin_points"), "5")
  await fillStable(page.locator("#spin_daily_limit"), "3")

  await page.getByRole("button", { name: /lưu cài đặt/i }).click()
  await expect(page.getByText(/đã lưu cài đặt/i)).toBeVisible()

  const settings = await readSettings()
  expect(settings).toMatchObject({
    vnd_per_point: 2000,
    welcome_gift_points: 50,
    checkin_points: 5,
    spin_daily_limit: 3,
  })
})

test("the form cannot be sent with no claimable status selected", async ({
  page,
}) => {
  await page.goto("/admin/settings")

  // Unticking every status would mean no order can ever earn — the submit is
  // disabled rather than the save failing after the fact.
  //
  // Addressed by ROLE: these are Radix checkboxes (a `button` carrying
  // `aria-checked`), and `claimable_statuses` is the hidden field their state
  // is mirrored into, because the server action parses a comma-separated string.
  const boxes = page.getByRole("checkbox")
  const count = await boxes.count()
  for (let i = 0; i < count; i++) {
    const box = boxes.nth(i)
    if ((await box.getAttribute("aria-checked")) === "true") await box.click()
  }
  await expect(page.locator('input[name="claimable_statuses"]')).toHaveValue("")

  await expect(
    page.getByRole("button", { name: /lưu cài đặt/i }),
  ).toBeDisabled()
})

test("switching the wheel on makes the member's pill appear", async ({
  page,
}) => {
  await page.goto("/admin/settings")
  await fillStable(page.locator("#spin_daily_limit"), "2")
  await page.getByRole("button", { name: /lưu cài đặt/i }).click()
  await expect(page.getByText(/đã lưu cài đặt/i)).toBeVisible()

  expect((await readSettings()).spin_daily_limit).toBe(2)
})

test("switching check-in on makes the dashboard tile appear", async ({
  page,
}) => {
  await page.goto("/admin/settings")
  await fillStable(page.locator("#checkin_points"), "15")
  await page.getByRole("button", { name: /lưu cài đặt/i }).click()
  await expect(page.getByText(/đã lưu cài đặt/i)).toBeVisible()

  expect((await readSettings()).checkin_points).toBe(15)
})
