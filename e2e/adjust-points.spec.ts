import { test, expect } from "@playwright/test"

import { ADMIN, MEMBER } from "./fixtures/accounts"
import { chooseOption, clickStable, fillStable } from "./fixtures/hydration"
import {
  clearTransactions,
  readCustomer,
  readTransactions,
  setPoints,
  setTier,
  tierIdByName,
} from "./fixtures/db"

// A-CUS, running as a signed-in ADMIN. adjustPoints is the only place staff can
// move a balance by hand, and the two rules it must never break — tier_id only
// goes up, and a granted tier invents no spend — are pinned in pgTAP. What this
// file adds is that the form actually reaches that RPC with the right arguments,
// including the acting admin's identity.

test.beforeEach(async () => {
  await setPoints(MEMBER.id, 100)
  await setTier(MEMBER.id, "Vàng")
  await clearTransactions(MEMBER.id)
})

type Page = import("@playwright/test").Page

async function openAdjust(page: Page) {
  await page.goto(`/admin/customers/${MEMBER.id}`)
  await expect(page.getByText(MEMBER.phone).first()).toBeVisible()
}

/**
 * Submitting the form only OPENS a confirmation dialog — an adjustment cannot be
 * undone, so it is behind the same kind of gate redemption is. Both steps have
 * to be driven or nothing reaches the RPC.
 */
async function apply(page: Page) {
  const dialog = page.getByRole("alertdialog")
  await clickStable(
    page.getByRole("button", { name: "Áp dụng điều chỉnh" }),
    dialog,
  )
  await dialog.getByRole("button", { name: "Đồng ý, áp dụng" }).click()
}

test("a grant moves the balance and records who made it", async ({ page }) => {
  await openAdjust(page)

  await fillStable(page.getByLabel("Điểm khả dụng"), "50")
  await fillStable(page.getByLabel("Lý do"), "E2E: bù điểm đơn lỗi")
  await apply(page)

  await expect
    .poll(async () => (await readCustomer(MEMBER.id)).current_points)
    .toBe(150)

  const rows = await readTransactions(MEMBER.id)
  const adjust = rows.find((r) => r.type === "ADJUST")
  expect(adjust?.amount).toBe(50)
  expect(adjust?.meta).toMatchObject({ reason: "E2E: bù điểm đơn lỗi" })
  // The actor comes from the admin's own session, never from the form.
  expect(JSON.stringify(adjust?.meta)).toContain(ADMIN.email)
})

test("an adjustment that would go negative is refused", async ({ page }) => {
  await openAdjust(page)

  await fillStable(page.getByLabel("Điểm khả dụng"), "-200")
  await fillStable(page.getByLabel("Lý do"), "E2E: trừ quá tay")
  await apply(page)

  // The RPC refuses with P0003 and the form says so. What matters is that
  // nothing moved and no ledger row was written: the balance and the ledger
  // must never be able to drift apart, even on a failure.
  await expect
    .poll(async () => (await readCustomer(MEMBER.id)).current_points)
    .toBe(100)
  expect(await readTransactions(MEMBER.id)).toHaveLength(0)
})

// A granted tier is a DECISION, not revenue. Inventing lifetime_spend to justify
// it would quietly move every "top N%" schedule the shop later queues.
test("granting a tier raises it without inventing any spend", async ({ page }) => {
  const before = await readCustomer(MEMBER.id)
  await openAdjust(page)

  await chooseOption(page, "Cấp hạng", /Kim cương/)
  await fillStable(page.getByLabel("Lý do"), "E2E: nâng hạng tri ân")
  await apply(page)

  const diamond = await tierIdByName("Kim cương")
  await expect.poll(async () => (await readCustomer(MEMBER.id)).tier_id).toBe(diamond)

  const after = await readCustomer(MEMBER.id)
  expect(after.lifetime_spend).toBe(before.lifetime_spend)
  expect(after.lifetime_points).toBe(before.lifetime_points)
})
