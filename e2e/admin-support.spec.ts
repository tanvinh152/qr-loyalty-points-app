import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import { db } from "./fixtures/db"

/** `/admin/support` — the staff half of the loop `/help` opens. */

async function seedTicket(status: "open" | "closed" = "open") {
  await db().from("support_requests").delete().eq("customer_id", MEMBER.id)
  const { error } = await db().from("support_requests").insert({
    customer_id: MEMBER.id,
    name: "Nguyễn Cần Giúp",
    email: MEMBER.email,
    topic: "points",
    message: "E2E nội dung yêu cầu hỗ trợ.",
    status,
  })
  if (error) throw new Error(`seedTicket: ${error.message}`)
}

test.afterAll(async () => {
  await db().from("support_requests").delete().eq("customer_id", MEMBER.id)
})

test("an open ticket can be read in full and closed", async ({ page }) => {
  await seedTicket("open")
  await page.goto("/admin/support")

  await page.getByRole("button", { name: /xem/i }).first().click()
  const dialog = page.getByRole("dialog")

  // The list truncates; the dialog is where the whole message lives, next to a
  // mailto: link — there is no in-app reply channel.
  await expect(dialog.getByText("E2E nội dung yêu cầu hỗ trợ.")).toBeVisible()
  // The reply link is labelled "Trả lời tới", not by the address — there is no
  // in-app reply channel, so this mailto is the whole of it.
  await expect(
    dialog.getByRole("link", { name: /trả lời tới/i }),
  ).toHaveAttribute("href", new RegExp(`^mailto:${MEMBER.email}`))

  await dialog.getByRole("button", { name: /đánh dấu đã xử lý/i }).click()

  await expect
    .poll(
      async () => {
        const { data } = await db()
          .from("support_requests")
          .select("status")
          .eq("customer_id", MEMBER.id)
          .single()
        return data?.status
      },
      { timeout: 20_000 },
    )
    .toBe("closed")
})

test("a closed ticket can be reopened", async ({ page }) => {
  await seedTicket("closed")
  await page.goto("/admin/support?status=closed")

  await page.getByRole("button", { name: /xem/i }).first().click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /mở lại/i })
    .click()

  await expect
    .poll(
      async () => {
        const { data } = await db()
          .from("support_requests")
          .select("status")
          .eq("customer_id", MEMBER.id)
          .single()
        return data?.status
      },
      { timeout: 20_000 },
    )
    .toBe("open")
})

test("the status filter splits the queue", async ({ page }) => {
  await seedTicket("open")

  // The list shows the member's own `full_name` in preference to the name typed
  // on the form — staff should see who the account is, not what was typed.
  const who = new RegExp(MEMBER.fullName, "i")

  await page.goto("/admin/support?status=open")
  await expect(page.getByText(who).first()).toBeVisible()

  await page.goto("/admin/support?status=closed")
  await expect(page.getByText(who)).toHaveCount(0)
})
