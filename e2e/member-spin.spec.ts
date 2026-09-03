import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import {
  clearTransactions,
  db,
  readCustomer,
  readSpinResults,
  readTransactions,
  restoreSeedSpinPrizes,
  setCustomer,
  setSettings,
  useOnlySpinPrize,
} from "./fixtures/db"

/**
 * The lucky wheel — a DIALOG, not a route. `/spin` was a page until
 * 2026-08-31; the folder that remains holds only the actions and the two client
 * components, and the trigger is the header pill, so the wheel is one control
 * away from every screen.
 *
 * A spin is weighted-random, so nothing here could assert an outcome against
 * the seeded wedges. Each case instead leaves the wheel no choice: one active
 * wedge holding all the weight (`useOnlySpinPrize`).
 *
 * `spin_daily_limit` is the feature switch — at 0 the pill is absent entirely,
 * which is how `seed.sql` ships. The file restores that at the end.
 */

/**
 * The trigger's accessible name is `nav.spin` ("Vòng quay"), not the dialog's
 * title — and the label is `sr-only` below `md`, never `hidden`, precisely so
 * the button keeps that name at every width.
 *
 * Not an exact match: when a spin or a gift is waiting the badge's `sr-only`
 * twin is part of the same button, so the full name reads "Vòng quay Còn 1
 * lượt quay hôm nay". That twin is the point of the badge, not noise.
 */
const pill = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^Vòng quay/ })

test.beforeEach(async () => {
  await setSettings({ spin_daily_limit: 1 })
  await db().from("spin_results").delete().eq("customer_id", MEMBER.id)
  await clearTransactions(MEMBER.id)
  await setCustomer(MEMBER.id, { current_points: 0, lifetime_points: 0 })
})

test.afterAll(async () => {
  await restoreSeedSpinPrizes()
  await setSettings({ spin_daily_limit: 0 })
})

test("there is no route left at /spin", async ({ page }) => {
  // The page was deleted deliberately; a reintroduced one would resurrect a
  // second, unlinked way into the feature.
  const res = await page.goto("/spin")
  expect(res?.status()).toBe(404)
})

test("the pill is absent while the wheel is switched off", async ({ page }) => {
  await setSettings({ spin_daily_limit: 0 })
  await page.goto("/dashboard")
  await expect(pill(page)).toHaveCount(0)
})

test("the wheel says it is resting when there is nothing to win", async ({
  page,
}) => {
  // Switched on, but every wedge deactivated: `loadSpinBoard` answers
  // `{ok:false, reason:"off"}` for both causes, and the member sees the same
  // honest "resting" panel rather than a spin button that always fails.
  await db().from("rewards").update({ is_active: false }).eq("kind", "spin")
  await page.goto("/dashboard")
  await pill(page).click()
  await expect(page.getByText(/vòng quay đang tạm nghỉ/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /^quay$/i })).toHaveCount(0)
})

test("a points wedge credits the balance and shows up in the win list", async ({
  page,
}) => {
  await useOnlySpinPrize({
    name: "E2E Điểm",
    prize_type: "points",
    points_amount: 150,
  })

  await page.goto("/dashboard")
  await pill(page).click()

  await page.getByRole("button", { name: /^quay$/i }).click()

  // The wheel animates to an answer the server already decided; the result
  // renders INLINE under it, never in a second dialog over the first.
  await expect(page.getByText(/chúc mừng/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/150 điểm đã được cộng/i)).toBeVisible()

  expect((await readCustomer(MEMBER.id)).current_points).toBe(150)

  const rows = await readTransactions(MEMBER.id)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ type: "EARN", source: "spin", amount: 150 })

  const results = await readSpinResults(MEMBER.id)
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({
    prize_type: "points",
    points_awarded: 150,
  })
})

test("the day's last spin leaves the button spent", async ({ page }) => {
  await useOnlySpinPrize({
    name: "E2E Điểm",
    prize_type: "points",
    points_amount: 10,
  })

  await page.goto("/dashboard")
  await pill(page).click()
  await page.getByRole("button", { name: /^quay$/i }).click()
  await expect(page.getByText(/chúc mừng/i)).toBeVisible({ timeout: 15_000 })

  // The result panel takes the spin button's place until it is dismissed — the
  // member is still reading it, and swapping it out from under them would be
  // the same mistake as reloading the board mid-spin.
  await page.getByRole("button", { name: /^đã hiểu$/i }).click()

  // `spin_daily_limit` is 1, so the board reloaded by `onSettled` comes back
  // with nothing left — and that reload happens only AFTER the wheel stops, so
  // the wedge that just landed never vanishes mid-turn.
  await expect(
    page.getByRole("button", { name: /hết lượt quay hôm nay/i }),
  ).toBeDisabled()

  expect(await readSpinResults(MEMBER.id)).toHaveLength(1)
})

test("a gift win waits at the counter, and says so on the pill", async ({
  page,
}) => {
  await useOnlySpinPrize({
    name: "E2E Quà",
    prize_type: "gift",
    quantity: 5,
  })

  await page.goto("/dashboard")
  await pill(page).click()
  await page.getByRole("button", { name: /^quay$/i }).click()

  await expect(page.getByText(/chúc mừng/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/đưa màn hình này cho nhân viên/i)).toBeVisible()

  // A gift is handed over by hand, so it stays unfulfilled — and no points move.
  const results = await readSpinResults(MEMBER.id)
  expect(results[0]).toMatchObject({ prize_type: "gift", points_awarded: 0 })
  expect(results[0].fulfilled_at).toBeNull()
  expect((await readCustomer(MEMBER.id)).current_points).toBe(0)

  await expect(page.getByText(/chưa nhận/i).first()).toBeVisible()

  // The dot on the pill is the ONLY place a member is told a gift is waiting,
  // so it carries an sr-only twin for a reader who cannot see it.
  await page.reload()
  await expect(
    page.getByText(/phần quà đang chờ bạn nhận/i).first(),
  ).toBeAttached()
})

test("a sold-out gift is not on the wheel at all", async ({ page }) => {
  await useOnlySpinPrize({
    name: "E2E Quà hết",
    prize_type: "gift",
    quantity: 0,
  })

  await page.goto("/dashboard")
  await pill(page).click()

  // Every remaining slice is a sold-out gift, so the eligible weight is zero
  // and the board reports itself off rather than offering an unwinnable spin.
  await expect(page.getByText(/vòng quay đang tạm nghỉ/i)).toBeVisible()
})
