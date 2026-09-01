import { test, expect } from "@playwright/test"

import { MEMBER, TEST_REWARD } from "./fixtures/accounts"
import { clickStable } from "./fixtures/hydration"
import {
  clearTransactions,
  readCustomer,
  readReward,
  setPoints,
  setReward,
} from "./fixtures/db"

// C-RWD. Spending points is the one irreversible thing a member can do — there
// is no refund path anywhere in this app — so each case asserts the DATABASE,
// not the toast. A toast is what the member was told; the row is what happened.

test.beforeEach(async () => {
  await setPoints(MEMBER.id, 600)
  await setReward(TEST_REWARD.id, {
    quantity: 100,
    is_active: true,
    points_cost: TEST_REWARD.pointsCost,
    min_tier_id: null,
  })
  await clearTransactions(MEMBER.id)
})

/**
 * The card for the reward this file drives. Anchored on its `<h3>`, which is the
 * only thing on the card guaranteed to be unique — the price, the chips and the
 * button text are all shared with every other reward on the page.
 */
function card(page: import("@playwright/test").Page) {
  return page
    .getByRole("heading", { name: TEST_REWARD.name })
    .locator("xpath=../..")
}

const trigger = (page: import("@playwright/test").Page) =>
  card(page).getByRole("button").first()

/** The shop streams in behind a loading skeleton, so wait for the real card. */
async function openShop(page: import("@playwright/test").Page) {
  await page.goto("/rewards")
  await card(page).waitFor()
}

async function redeem(page: import("@playwright/test").Page) {
  await openShop(page)
  // Spending is irreversible, so it goes through a confirmation dialog.
  const dialog = page.getByRole("alertdialog")
  await clickStable(trigger(page), dialog)
  await dialog.getByRole("button", { name: "Đổi quà", exact: true }).click()
}

test("redeeming debits the balance and takes a unit of stock", async ({ page }) => {
  await redeem(page)

  await expect
    .poll(async () => (await readCustomer(MEMBER.id)).current_points)
    .toBe(100)

  expect((await readReward(TEST_REWARD.id)).quantity).toBe(99)

  await page.goto("/history")
  await expect(page.locator("body")).toContainText(TEST_REWARD.name)
})

test("a member short of the price cannot spend anything", async ({ page }) => {
  await setPoints(MEMBER.id, 400)
  await openShop(page)

  await expect(trigger(page)).toBeDisabled()

  expect((await readCustomer(MEMBER.id)).current_points).toBe(400)
  expect((await readReward(TEST_REWARD.id)).quantity).toBe(100)
})

test("a sold-out reward cannot be spent on", async ({ page }) => {
  await setReward(TEST_REWARD.id, { quantity: 0 })
  await openShop(page)

  await expect(trigger(page)).toBeDisabled()
  expect((await readCustomer(MEMBER.id)).current_points).toBe(600)
})

// The stale-tab case, and the reason the server re-checks everything the card
// already checked: the page rendered while the reward was live, and the admin
// pulled it a moment later. The dialog must be refused, not honoured.
test("a reward pulled after the page rendered is refused by the server", async ({
  page,
}) => {
  await openShop(page)
  await expect(trigger(page)).toBeEnabled()

  await setReward(TEST_REWARD.id, { is_active: false })

  const dialog = page.getByRole("alertdialog")
  await clickStable(trigger(page), dialog)
  await dialog.getByRole("button", { name: "Đổi quà", exact: true }).click()

  // Nothing moved: not the balance, not the stock.
  await expect
    .poll(async () => (await readCustomer(MEMBER.id)).current_points)
    .toBe(600)
  expect((await readReward(TEST_REWARD.id)).quantity).toBe(100)
})
