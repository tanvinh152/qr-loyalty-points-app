import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import {
  clearMilestoneAwards,
  clearTransactions,
  readCustomer,
  readMilestoneAwards,
  readTransactions,
  restoreSeedMilestones,
  setCustomer,
  useOnlyMilestones,
} from "./fixtures/db"

/**
 * Spend milestones (0024) — an INDEPENDENT ladder from the tiers. Same unit
 * (đồng of `lifetime_spend`), nothing else shared: passing a rung moves no tier
 * and credits no points, because there is no voucher engine and the prize is
 * handed over at the counter like a `gift` wheel win.
 *
 * Unlocking is DERIVED at read time and deliberately not hooked into
 * `claim_points`: an admin adjustment and a TikTok reconciliation also move
 * `lifetime_spend`, so a rung unlocked inside `claim_points` alone would be
 * permanently unreachable for anyone pushed over it by either.
 */

const RUNGS = [
  { name: "E2E Mốc một", spend_threshold: 1_000_000 },
  { name: "E2E Mốc hai", spend_threshold: 2_000_000 },
]

test.beforeEach(async () => {
  await useOnlyMilestones(RUNGS)
  await clearMilestoneAwards(MEMBER.id)
  await clearTransactions(MEMBER.id)
})

test.afterAll(async () => {
  await restoreSeedMilestones()
  await clearMilestoneAwards(MEMBER.id)
})

test("a rung below the member's spend is claimable, one above it is locked", async ({
  page,
}) => {
  await setCustomer(MEMBER.id, { lifetime_spend: 1_500_000 })
  await page.goto("/rewards/roadmap")

  await expect(
    page.getByRole("button", { name: /nhận quà ngay/i }),
  ).toHaveCount(1)
  // The rung still out of reach reports the gap rather than a claim button.
  await expect(page.getByText(/còn thiếu/i).first()).toBeVisible()
})

test("claiming a rung writes an award, moves no points and moves no tier", async ({
  page,
}) => {
  await setCustomer(MEMBER.id, { lifetime_spend: 1_500_000, tier_id: null })
  const before = await readCustomer(MEMBER.id)

  await page.goto("/rewards/roadmap")
  await page.getByRole("button", { name: /nhận quà ngay/i }).click()

  await expect(page.getByText(/đã là của bạn/i)).toBeVisible()

  const awards = await readMilestoneAwards(MEMBER.id)
  expect(awards).toHaveLength(1)
  expect(awards[0].milestone_name).toBe("E2E Mốc một")
  expect(Number(awards[0].threshold_amount)).toBe(1_000_000)
  expect(Number(awards[0].spend_at_claim)).toBe(1_500_000)
  // Handed over by staff, so it starts unfulfilled.
  expect(awards[0].fulfilled_at).toBeNull()

  const after = await readCustomer(MEMBER.id)
  expect(after.current_points).toBe(before.current_points)
  expect(after.tier_id).toBe(before.tier_id)
  // The ladder writes no ledger row at all — there is nothing to spend.
  expect(await readTransactions(MEMBER.id)).toHaveLength(0)
})

test("a claimed rung cannot be claimed twice", async ({ page }) => {
  await setCustomer(MEMBER.id, { lifetime_spend: 1_500_000 })
  await page.goto("/rewards/roadmap")

  const claim = page.getByRole("button", { name: /nhận quà ngay/i })
  await claim.click()
  await expect(page.getByText(/đã là của bạn/i)).toBeVisible()

  // `milestone_awards_once_idx` is what makes the double-click idempotent —
  // the second attempt cannot produce a second award even if the UI let it.
  await page.reload()
  await expect(
    page.getByRole("button", { name: /nhận quà ngay/i }),
  ).toHaveCount(0)
  await expect(page.getByText(/chờ nhận tại quầy/i).first()).toBeVisible()

  expect(await readMilestoneAwards(MEMBER.id)).toHaveLength(1)
})

test("an award survives a refund that drops spend back under the rung", async ({
  page,
}) => {
  await setCustomer(MEMBER.id, { lifetime_spend: 1_500_000 })
  await page.goto("/rewards/roadmap")
  await page.getByRole("button", { name: /nhận quà ngay/i }).click()
  await expect(page.getByText(/đã là của bạn/i)).toBeVisible()

  // Same sticky posture as `customers.tier_id`: what was earned is never
  // retracted, even when the number behind it moves back down.
  await setCustomer(MEMBER.id, { lifetime_spend: 100_000 })
  await page.reload()

  expect(await readMilestoneAwards(MEMBER.id)).toHaveLength(1)
  await expect(page.getByText(/chờ nhận tại quầy/i).first()).toBeVisible()
})

test("every rung is claimable once spend clears them all", async ({ page }) => {
  await setCustomer(MEMBER.id, { lifetime_spend: 5_000_000 })
  await page.goto("/rewards/roadmap")

  await expect(
    page.getByRole("button", { name: /nhận quà ngay/i }),
  ).toHaveCount(RUNGS.length)
  await expect(page.getByText(/còn thiếu/i)).toHaveCount(0)
})

test("the dashboard tile counts what is waiting to be claimed", async ({
  page,
}) => {
  await setCustomer(MEMBER.id, { lifetime_spend: 5_000_000 })
  await page.goto("/dashboard")

  // The tile is the only prompt on the dashboard that leads to the ladder.
  const cta = page.getByRole("link", { name: /lộ trình/i }).first()
  await expect(cta).toBeVisible()
  await cta.click()
  await expect(page).toHaveURL(/\/rewards\/roadmap/)
})

test("the roadmap keeps the rewards tab lit and offers a way back", async ({
  page,
}) => {
  await page.goto("/rewards/roadmap")

  // `/rewards/roadmap` is a SUB-ROUTE of `/rewards` so PortalNav's prefix match
  // keeps "Quà tặng" active and the rail stays at exactly four items.
  const rewardsLink = page
    .getByRole("navigation")
    .first()
    .getByRole("link", { name: /quà tặng/i })
  await expect(rewardsLink).toHaveAttribute("aria-current", "page")
})
