import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import { db } from "./fixtures/db"
import { fillStable } from "./fixtures/hydration"

/**
 * `/help` — the member half of the support loop. The admin half
 * (`/admin/support`, close/reopen) is driven in `admin-support.spec.ts`; this
 * file proves a ticket is created and attributed.
 */

async function clearTickets() {
  const { error } = await db()
    .from("support_requests")
    .delete()
    .eq("customer_id", MEMBER.id)
  if (error) throw new Error(`clearTickets: ${error.message}`)
}

test.beforeEach(clearTickets)
test.afterAll(clearTickets)

test("a support request is filed against the member who sent it", async ({
  page,
}) => {
  await page.goto("/help")

  // Name and email arrive prefilled from the member's own record.
  await expect(page.locator("#support-email")).toHaveValue(MEMBER.email)

  await fillStable(page.locator("#support-name"), "Nguyễn Cần Giúp")
  await page.selectOption("#support-topic", "points")
  await fillStable(
    page.locator("#support-message"),
    "Đơn hàng của tôi chưa được cộng điểm.",
  )

  await page.getByRole("button", { name: /gửi yêu cầu/i }).click()
  await expect(page.getByText(/đã gửi|cảm ơn/i).first()).toBeVisible()

  const { data } = await db()
    .from("support_requests")
    .select("name, email, topic, message, status, customer_id")
    .eq("customer_id", MEMBER.id)

  expect(data).toHaveLength(1)
  expect(data![0]).toMatchObject({
    name: "Nguyễn Cần Giúp",
    topic: "points",
    status: "open",
    message: "Đơn hàng của tôi chưa được cộng điểm.",
  })
})

test("the form is emptied after a successful send", async ({ page }) => {
  await page.goto("/help")
  await fillStable(page.locator("#support-name"), "Nguyễn Cần Giúp")
  await page.selectOption("#support-topic", "bug")
  await fillStable(page.locator("#support-message"), "Nút đổi quà bị lỗi.")
  await page.getByRole("button", { name: /gửi yêu cầu/i }).click()

  await expect(page.getByText(/đã gửi|cảm ơn/i).first()).toBeVisible()
  // Resetting matters: without it a double submit files the same ticket twice.
  await expect(page.locator("#support-message")).toHaveValue("")
})

test("an empty message is refused before anything is filed", async ({
  page,
}) => {
  await page.goto("/help")
  await page.getByRole("button", { name: /gửi yêu cầu/i }).click()

  const { data } = await db()
    .from("support_requests")
    .select("id")
    .eq("customer_id", MEMBER.id)
  expect(data).toHaveLength(0)
})
