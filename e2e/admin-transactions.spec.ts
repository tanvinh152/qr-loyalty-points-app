import { expect, test } from "@playwright/test"

import { MEMBER, MEMBER_B } from "./fixtures/accounts"
import { clearTransactions, db } from "./fixtures/db"

/**
 * `/admin/transactions` and `/admin/customers` — the read-only halves of the
 * admin portal. (`adjust-points.spec.ts` covers the one write.)
 *
 * Assertions are made against rows this file created, never a global count:
 * pgTAP and the rest of this suite share the database and leave rows behind.
 */

const MARK = "ADMTX"

async function seed() {
  await clearTransactions(MEMBER.id)
  const { error } = await db()
    .from("transactions")
    .insert([
      {
        customer_id: MEMBER.id,
        phone: MEMBER.phone,
        type: "EARN",
        amount: 111,
        source: "webhook",
        order_code: `${MARK}-EARN`,
        created_at: "2026-02-10T03:00:00Z",
      },
      {
        customer_id: MEMBER.id,
        phone: MEMBER.phone,
        type: "REDEEM",
        amount: -222,
        source: "redeem",
        order_code: `${MARK}-REDEEM`,
        created_at: "2026-06-10T03:00:00Z",
      },
      {
        customer_id: MEMBER.id,
        phone: MEMBER.phone,
        type: "ADJUST",
        amount: 333,
        source: "admin",
        order_code: `${MARK}-ADJUST`,
        created_at: "2026-07-10T03:00:00Z",
      },
    ])
  if (error) throw new Error(`seed: ${error.message}`)
}

test.beforeEach(seed)
test.afterAll(async () => clearTransactions(MEMBER.id))

const shown = (page: import("@playwright/test").Page, text: string) =>
  page.getByText(text, { exact: false }).filter({ visible: true })

test("the ledger lists every kind of movement", async ({ page }) => {
  await page.goto(`/admin/transactions?q=${MARK}`)
  await expect(shown(page, "111").first()).toBeVisible()
  await expect(shown(page, "222").first()).toBeVisible()
  await expect(shown(page, "333").first()).toBeVisible()
})

test("the type filter narrows to one kind", async ({ page }) => {
  await page.goto(`/admin/transactions?q=${MARK}&type=REDEEM`)
  await expect(shown(page, "222").first()).toBeVisible()
  await expect(shown(page, "111")).toHaveCount(0)
  await expect(shown(page, "333")).toHaveCount(0)
})

test("the source filter narrows to one origin", async ({ page }) => {
  await page.goto(`/admin/transactions?q=${MARK}&source=admin`)
  await expect(shown(page, "333").first()).toBeVisible()
  await expect(shown(page, "111")).toHaveCount(0)
})

test("a date range narrows the ledger", async ({ page }) => {
  await page.goto(`/admin/transactions?q=${MARK}&from=2026-06-01&to=2026-06-30`)
  await expect(shown(page, "222").first()).toBeVisible()
  await expect(shown(page, "111")).toHaveCount(0)
  await expect(shown(page, "333")).toHaveCount(0)
})

test("a nonsense filter value is ignored rather than emptying the page", async ({
  page,
}) => {
  // A URL can be typed or bookmarked, and an unknown enum must not read as
  // "no results" — that looks like data loss.
  await page.goto(`/admin/transactions?q=${MARK}&type=NOT_A_TYPE&source=nope`)
  await expect(shown(page, "111").first()).toBeVisible()
  await expect(shown(page, "222").first()).toBeVisible()
})

test("a customer is findable by phone and opens their record", async ({
  page,
}) => {
  await page.goto(`/admin/customers?q=${MEMBER.phone}`)

  const link = page.getByRole("link", {
    name: new RegExp(MEMBER.fullName, "i"),
  })
  await expect(link.first()).toBeVisible()
  await link.first().click()

  await expect(page).toHaveURL(new RegExp(`/admin/customers/${MEMBER.id}`))
  await expect(shown(page, MEMBER.phone).first()).toBeVisible()
})

test("a search matching one member does not list the other", async ({
  page,
}) => {
  await page.goto(`/admin/customers?q=${MEMBER.phone}`)
  await expect(page.getByText(MEMBER_B.phone)).toHaveCount(0)
})
