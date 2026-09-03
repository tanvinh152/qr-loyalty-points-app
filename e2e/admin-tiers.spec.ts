import { expect, test } from "@playwright/test"

import { clearSchedules, db, tierIdByName } from "./fixtures/db"
import { fillStable } from "./fixtures/hydration"

/**
 * `/admin/tiers` — the five-rung ladder.
 *
 * Adjust-only by design: no create, no delete. `saveTier` refuses a payload
 * with no id and drops `name`/`sort_order` entirely, so the shape of the ladder
 * is not something the UI can change.
 *
 * Thresholds only ever go UP, and they go up through
 * `tier_threshold_schedules` — which never touches `customers.tier_id`. That
 * omission is the grandfathering, and `api-cron.spec.ts` guards it end to end.
 */

const SEEDED: Record<string, number> = {
  Bạc: 1_000_000,
  Vàng: 2_000_000,
  "Bạch kim": 4_000_000,
}

async function restoreThresholds() {
  for (const [name, amount] of Object.entries(SEEDED)) {
    await db()
      .from("membership_tiers")
      .update({ spend_threshold: amount })
      .eq("name", name)
  }
}

test.beforeEach(async () => {
  await clearSchedules()
  await restoreThresholds()
})

test.afterAll(async () => {
  await clearSchedules()
  await restoreThresholds()
})

const save = async (dialog: import("@playwright/test").Locator) => {
  await dialog.getByRole("button", { name: /^lưu$/i }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

test("a tier's threshold and multiplier are editable", async ({ page }) => {
  await page.goto("/admin/tiers")
  await page.getByRole("button", { name: /^Sửa — Vàng$/ }).click()

  const dialog = page.getByRole("dialog")
  await fillStable(dialog.locator('[name="spend_threshold"]'), "2500000")
  await fillStable(dialog.locator('[name="multiplier"]'), "1.2")
  await save(dialog)

  const { data } = await db()
    .from("membership_tiers")
    .select("spend_threshold, multiplier")
    .eq("name", "Vàng")
    .single()
  expect(Number(data!.spend_threshold)).toBe(2_500_000)
  expect(Number(data!.multiplier)).toBe(1.2)
})

test("a threshold cannot cross the rung below it", async ({ page }) => {
  await page.goto("/admin/tiers")
  await page.getByRole("button", { name: /^Sửa — Vàng$/ }).click()

  const dialog = page.getByRole("dialog")
  // Bạc sits at 1.000.000đ; a Vàng below that would make the ladder unorderable.
  await fillStable(dialog.locator('[name="spend_threshold"]'), "500000")
  await dialog.getByRole("button", { name: /^lưu$/i }).click()

  await expect(dialog.getByText(/tụt xuống bằng hoặc dưới/i)).toBeVisible()
  const { data } = await db()
    .from("membership_tiers")
    .select("spend_threshold")
    .eq("name", "Vàng")
    .single()
  expect(Number(data!.spend_threshold)).toBe(2_000_000)
})

test("a threshold cannot cross the rung above it", async ({ page }) => {
  await page.goto("/admin/tiers")
  await page.getByRole("button", { name: /^Sửa — Vàng$/ }).click()

  const dialog = page.getByRole("dialog")
  // Bạch kim sits at 4.000.000đ.
  await fillStable(dialog.locator('[name="spend_threshold"]'), "5000000")
  await dialog.getByRole("button", { name: /^lưu$/i }).click()

  await expect(dialog.getByText(/vượt lên bằng hoặc trên/i)).toBeVisible()
})

test("a raise can be queued for a future date and then cancelled", async ({
  page,
}) => {
  await page.goto("/admin/tiers")
  await page
    .getByRole("button", { name: /hẹn nâng mốc/i })
    .first()
    .click()

  const dialog = page.getByRole("dialog")
  await fillStable(dialog.locator('[name="target_amount"]'), "3000000")
  await fillStable(dialog.locator('[name="effective_at"]'), "2027-01-01T09:00")
  await fillStable(dialog.locator('[name="note"]'), "E2E lịch")
  await dialog.getByRole("button", { name: /đặt lịch nâng mốc/i }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })

  const { data } = await db()
    .from("tier_threshold_schedules")
    .select("mode, target_amount, applied_at, note")
  expect(data).toHaveLength(1)
  expect(data![0]).toMatchObject({
    mode: "amount",
    applied_at: null,
    note: "E2E lịch",
  })

  // Nothing has moved yet — the raise lands on its date, not on save.
  const { data: tier } = await db()
    .from("membership_tiers")
    .select("spend_threshold")
    .eq("id", await tierIdByName("Bạc"))
    .single()
  expect(Number(tier!.spend_threshold)).toBe(1_000_000)

  await page
    .getByRole("button", { name: /hủy lịch nâng mốc/i })
    .first()
    .click()
  const confirm = page.getByRole("alertdialog")
  if (await confirm.isVisible().catch(() => false)) {
    await confirm
      .getByRole("button", { name: /hủy lịch|xác nhận|xóa/i })
      .first()
      .click()
  }

  await expect
    .poll(
      async () =>
        (await db().from("tier_threshold_schedules").select("id")).data?.length,
    )
    .toBe(0)
})

test("a tier may hold only one pending raise", async ({ page }) => {
  const silver = await tierIdByName("Bạc")
  const { error } = await db().from("tier_threshold_schedules").insert({
    tier_id: silver,
    mode: "amount",
    target_amount: 1_500_000,
    effective_at: "2027-06-01T02:00:00Z",
  })
  if (error) throw new Error(error.message)

  await page.goto("/admin/tiers")
  await page
    .getByRole("button", { name: /hẹn nâng mốc/i })
    .first()
    .click()

  const dialog = page.getByRole("dialog")
  await fillStable(dialog.locator('[name="target_amount"]'), "1800000")
  await fillStable(dialog.locator('[name="effective_at"]'), "2027-09-01T09:00")
  await dialog.getByRole("button", { name: /đặt lịch nâng mốc/i }).click()

  // Two queued raises for one tier would apply in an order nobody chose, so
  // the partial unique index refuses the second and the dialog says why.
  await expect(
    dialog.getByText(/đã có một lịch nâng mốc đang chờ/i),
  ).toBeVisible()
})

test("opening the page applies a raise that has come due", async ({ page }) => {
  const silver = await tierIdByName("Bạc")
  const { error } = await db()
    .from("tier_threshold_schedules")
    .insert({
      tier_id: silver,
      mode: "amount",
      target_amount: 1_100_000,
      effective_at: new Date(Date.now() - 86_400_000).toISOString(),
    })
  if (error) throw new Error(error.message)

  // Fired fire-and-forget on render, which is what makes the feature work on a
  // deployment with no cron configured at all.
  await page.goto("/admin/tiers")

  await expect
    .poll(
      async () =>
        Number(
          (
            await db()
              .from("membership_tiers")
              .select("spend_threshold")
              .eq("id", silver)
              .single()
          ).data!.spend_threshold,
        ),
      { timeout: 20_000 },
    )
    .toBe(1_100_000)
})
