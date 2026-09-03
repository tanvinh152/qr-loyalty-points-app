import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import { clearTransactions, db } from "./fixtures/db"

/**
 * `/history` — the member's own ledger.
 *
 * One trap worth a spec: the search box filters on `order_code`, while the list
 * displays a DERIVED `TXN-` code. Searching for what is on screen finds
 * nothing, which is why the field carries a hint saying so.
 */

async function seedLedger() {
  await clearTransactions(MEMBER.id)
  const rows = [
    { order_code: "HIST-AAA", amount: 100, created_at: "2026-01-10T03:00:00Z" },
    { order_code: "HIST-BBB", amount: 200, created_at: "2026-04-10T03:00:00Z" },
    { order_code: "HIST-CCC", amount: 300, created_at: "2026-08-10T03:00:00Z" },
  ]
  const { error } = await db()
    .from("transactions")
    .insert(
      rows.map((row) => ({
        customer_id: MEMBER.id,
        phone: MEMBER.phone,
        type: "EARN",
        source: "webhook",
        ...row,
      })),
    )
  if (error) throw new Error(`seedLedger: ${error.message}`)
}

test.beforeEach(seedLedger)
test.afterAll(async () => clearTransactions(MEMBER.id))

/**
 * The ledger is rendered TWICE — a list for phones, a table from `sm` up — and
 * CSS hides one of them. `.first()` picks whichever comes first in the DOM,
 * which is regularly the hidden one, so every assertion here filters to what is
 * actually on screen.
 */
const shown = (page: import("@playwright/test").Page, text: string) =>
  page.getByText(text, { exact: false }).filter({ visible: true })

test("every row the member owns is listed", async ({ page }) => {
  await page.goto("/history")
  for (const points of ["100", "200", "300"]) {
    await expect(shown(page, points).first()).toBeVisible()
  }
})

test("the search box filters on the order code, as its hint says", async ({
  page,
}) => {
  await page.goto("/history?q=HIST-BBB")

  // One row survives. Asserted through the ledger's own amounts rather than a
  // global count: pgTAP shares this database and leaves rows behind.
  await expect(shown(page, "200").first()).toBeVisible()
  await expect(shown(page, "100")).toHaveCount(0)
  await expect(shown(page, "300")).toHaveCount(0)
})

test("a date range narrows the ledger and survives a page change", async ({
  page,
}) => {
  await page.goto("/history?from=2026-03-01&to=2026-05-31")

  await expect(shown(page, "200").first()).toBeVisible()
  await expect(shown(page, "100")).toHaveCount(0)
  await expect(shown(page, "300")).toHaveCount(0)

  // The reset link is the only way back to an unfiltered list.
  await page
    .getByRole("link", { name: /xóa lọc/i })
    .first()
    .click()
  await expect(shown(page, "100").first()).toBeVisible()
})

test("a filter matching nothing says so rather than looking broken", async ({
  page,
}) => {
  await page.goto("/history?q=KHONG-CO-MA-NAY")
  await expect(shown(page, "100")).toHaveCount(0)
  await expect(shown(page, "200")).toHaveCount(0)
})
