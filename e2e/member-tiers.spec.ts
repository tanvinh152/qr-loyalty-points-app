import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import { clearSchedules, db, setCustomer, tierIdByName } from "./fixtures/db"

/**
 * `/tiers` — the member's view of the spend ladder.
 *
 * Tiers are SPEND, points are currency: `membership_tiers.spend_threshold` is
 * đồng measured against `customers.lifetime_spend`, and `lifetime_points`
 * decides nothing about a tier. `customers.tier_id` is the HIGHEST TIER EVER
 * HELD — sticky, only ever raised.
 */

const RESTORE = {
  lifetime_spend: 2_000_000,
  current_points: 600,
  lifetime_points: 600,
}

test.afterAll(async () => {
  await clearSchedules()
  await db().from("customer_tier_history").delete().eq("customer_id", MEMBER.id)
  await setCustomer(MEMBER.id, {
    ...RESTORE,
    tier_id: await tierIdByName("Bạc"),
  })
  await db()
    .from("membership_tiers")
    .update({ spend_threshold: 2_000_000 })
    .eq("name", "Vàng")
})

test("a member with no tier still sees the whole ladder", async ({ page }) => {
  await setCustomer(MEMBER.id, { tier_id: null, lifetime_spend: 0 })
  await page.goto("/tiers")

  await expect(page.getByText(/chưa có hạng/i).first()).toBeVisible()
  // The ladder is rendered for everyone, including someone not yet on it — it
  // is the thing being sold. Filtered to the visible copy: the ladder is a
  // table from `sm` up and a stack of cards below it, and CSS hides one.
  for (const tier of ["Bạc", "Vàng", "Bạch kim", "Kim cương", "Ruby"]) {
    await expect(
      page.getByText(tier, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible()
  }
})

test("the progress card counts đồng of spend, not points", async ({ page }) => {
  // Deliberately lopsided: a big point balance and a small spend. If the screen
  // read points, this member would look far further up the ladder than they are.
  await setCustomer(MEMBER.id, {
    tier_id: await tierIdByName("Bạc"),
    lifetime_spend: 1_200_000,
    current_points: 99_999,
    lifetime_points: 99_999,
  })
  await page.goto("/tiers")

  // 2.000.000 - 1.200.000 = 800.000 still to spend to reach Vàng.
  await expect(page.getByText(/còn .*800.000.*vàng/i).first()).toBeVisible()
})

test("the member card shows a masked number, never the full one", async ({
  page,
}) => {
  await setCustomer(MEMBER.id, { tier_id: await tierIdByName("Bạc") })
  await page.goto("/tiers")

  await page.getByRole("button", { name: /xem thẻ thành viên/i }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  // The card is a screen the member holds up in a shop, so it masks the number
  // the same way Pancake does.
  const masked = MEMBER.phone.replace(/^(\d{2})\d+(\d{2})$/, "$1••••$2")
  await expect(dialog.getByText(masked)).toBeVisible()
  await expect(dialog.getByText(MEMBER.phone)).toHaveCount(0)
})

test("a tier held before the bar moved is kept, and said so", async ({
  page,
}) => {
  const goldId = await tierIdByName("Vàng")
  await setCustomer(MEMBER.id, { tier_id: goldId, lifetime_spend: 2_000_000 })

  // The note is only shown for a tier the member can be PROVEN to have earned,
  // so it needs the award row `claim_points` would have written.
  await db().from("customer_tier_history").delete().eq("customer_id", MEMBER.id)
  const { error } = await db().from("customer_tier_history").insert({
    customer_id: MEMBER.id,
    tier_id: goldId,
    tier_name: "Vàng",
    threshold_amount: 2_000_000,
    spend_at_award: 2_000_000,
    source: "claim",
  })
  if (error) throw new Error(`seed tier history: ${error.message}`)

  // The bar rises above what this member ever spent. Thresholds only ever go
  // up, and `apply_due_tier_schedules` never touches `customers.tier_id` —
  // that omission IS the grandfathering.
  await db()
    .from("membership_tiers")
    .update({ spend_threshold: 5_000_000 })
    .eq("id", goldId)

  await page.goto("/tiers")
  await expect(page.getByText(/giữ vĩnh viễn/i).first()).toBeVisible()
})
