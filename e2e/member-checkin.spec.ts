import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import {
  clearCheckins,
  clearTransactions,
  readCustomer,
  readTransactions,
  setCustomer,
  setSettings,
} from "./fixtures/db"

/**
 * Daily check-in — a Pancake-independent way to earn, added in 0019.
 *
 * `checkin_points` is a feature switch as much as an amount: at 0 the whole
 * tile is absent, not disabled. `seed.sql` leaves it at 0, so every case here
 * turns it on first and the file puts it back afterwards — otherwise this spec
 * silently changes what every other dashboard spec renders.
 */

const POINTS = 25

test.beforeEach(async () => {
  await setSettings({ checkin_points: POINTS })
  await clearCheckins(MEMBER.id)
  await clearTransactions(MEMBER.id)
  await setCustomer(MEMBER.id, { current_points: 0, lifetime_points: 0 })
})

test.afterAll(async () => {
  await setSettings({ checkin_points: 0 })
  await clearCheckins(MEMBER.id)
})

test("the tile is absent while check-in is switched off", async ({ page }) => {
  await setSettings({ checkin_points: 0 })
  await page.goto("/dashboard")
  await expect(page.getByRole("button", { name: /^điểm danh$/i })).toHaveCount(
    0,
  )
})

test("checking in awards the configured points and stays done", async ({
  page,
}) => {
  await page.goto("/dashboard")

  const button = page.getByRole("button", { name: /^điểm danh$/i })
  await button.click()

  await expect(page.getByText(`+${POINTS} điểm`)).toBeVisible()
  await expect(
    page.getByRole("button", { name: /đã điểm danh hôm nay/i }),
  ).toBeDisabled()

  expect((await readCustomer(MEMBER.id)).current_points).toBe(POINTS)

  const rows = await readTransactions(MEMBER.id)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    type: "EARN",
    source: "checkin",
    amount: POINTS,
  })

  // The done state is the server's, not a leftover of this tab's optimism.
  await page.reload()
  await expect(
    page.getByRole("button", { name: /đã điểm danh hôm nay/i }),
  ).toBeDisabled()
})

test("a second check-in the same day earns nothing and raises no alarm", async ({
  page,
}) => {
  await page.goto("/dashboard")
  await page.getByRole("button", { name: /^điểm danh$/i }).click()
  await expect(
    page.getByRole("button", { name: /đã điểm danh hôm nay/i }),
  ).toBeDisabled()

  // Second attempt from a stale tab: the button is enabled again there because
  // that page never saw the first click.
  const other = await page.context().newPage()
  await other.goto("/dashboard")
  await clearCheckinsOnlyInTheBrowser(other)
  await other.close()

  expect((await readCustomer(MEMBER.id)).current_points).toBe(POINTS)
  expect(await readTransactions(MEMBER.id)).toHaveLength(1)
})

/**
 * Drives the "someone else's tab got there first" path.
 *
 * The action answers `already_checked_in`, and the button must flip to done
 * SILENTLY — an error toast here would tell a member something went wrong when
 * nothing did.
 */
async function clearCheckinsOnlyInTheBrowser(
  page: import("@playwright/test").Page,
) {
  const button = page.getByRole("button", { name: /^điểm danh$/i })
  if ((await button.count()) === 0) return
  await button.click()
  await expect(
    page.getByRole("button", { name: /đã điểm danh hôm nay/i }),
  ).toBeDisabled()
  await expect(page.getByText(/không thành công/i)).toHaveCount(0)
}
