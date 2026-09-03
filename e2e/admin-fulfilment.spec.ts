import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import { db, restoreSeedSpinPrizes, useOnlySpinPrize } from "./fixtures/db"

/**
 * The two hand-over queues: `/admin/spin/winners` and
 * `/admin/milestones/awards`.
 *
 * Both exist because this app has no voucher engine. A `gift` wheel wedge and
 * every milestone rung are settled at the counter, so "fulfilled" is a thing a
 * person asserts, and the member's only notice that something is waiting is the
 * badge on the header pill. Nothing else closes that loop.
 */

test.afterAll(async () => {
  await db().from("spin_results").delete().eq("customer_id", MEMBER.id)
  await db().from("milestone_awards").delete().eq("customer_id", MEMBER.id)
  await restoreSeedSpinPrizes()
})

test("a gift win is marked handed over, and can be undone", async ({
  page,
}) => {
  await db().from("spin_results").delete().eq("customer_id", MEMBER.id)
  const prizeId = await useOnlySpinPrize({
    name: "E2E Quà trao tay",
    prize_type: "gift",
    quantity: 3,
  })
  const { error } = await db()
    .from("spin_results")
    .insert({
      customer_id: MEMBER.id,
      prize_id: prizeId,
      prize_name: "E2E Quà trao tay",
      prize_type: "gift",
      points_awarded: 0,
      spin_date: new Date().toISOString().slice(0, 10),
    })
  if (error) throw new Error(error.message)

  await page.goto("/admin/spin/winners")
  await expect(page.getByText("E2E Quà trao tay").first()).toBeVisible()

  await page
    .getByRole("button", { name: /đánh dấu đã trao/i })
    .first()
    .click()

  await expect
    .poll(
      async () => {
        const { data } = await db()
          .from("spin_results")
          .select("fulfilled_at, fulfilled_by")
          .eq("customer_id", MEMBER.id)
          .single()
        return data?.fulfilled_at !== null
      },
      { timeout: 20_000 },
    )
    .toBe(true)

  // Stamped with WHO handed it over, not just when — the queue is an audit
  // trail as much as a checklist.
  const { data } = await db()
    .from("spin_results")
    .select("fulfilled_by")
    .eq("customer_id", MEMBER.id)
    .single()
  expect(data!.fulfilled_by).not.toBeNull()

  // Undo exists because the button is pressed by a person who can misclick.
  await page
    .getByRole("button", { name: /hoàn tác/i })
    .first()
    .click()
  await expect
    .poll(
      async () => {
        const { data: back } = await db()
          .from("spin_results")
          .select("fulfilled_at")
          .eq("customer_id", MEMBER.id)
          .single()
        return back?.fulfilled_at
      },
      { timeout: 20_000 },
    )
    .toBeNull()
})

test("a milestone claim is marked handed over", async ({ page }) => {
  await db().from("milestone_awards").delete().eq("customer_id", MEMBER.id)
  const { error } = await db().from("milestone_awards").insert({
    customer_id: MEMBER.id,
    milestone_name: "E2E Mốc trao tay",
    threshold_amount: 1_000_000,
    spend_at_claim: 1_500_000,
  })
  if (error) throw new Error(error.message)

  await page.goto("/admin/milestones/awards")
  await expect(page.getByText("E2E Mốc trao tay").first()).toBeVisible()

  await page
    .getByRole("button", { name: /đánh dấu đã trao/i })
    .first()
    .click()

  await expect
    .poll(
      async () => {
        const { data } = await db()
          .from("milestone_awards")
          .select("fulfilled_at")
          .eq("customer_id", MEMBER.id)
          .single()
        return data?.fulfilled_at !== null
      },
      { timeout: 20_000 },
    )
    .toBe(true)
})

test("the pending filter hides what has already been handed over", async ({
  page,
}) => {
  await db().from("milestone_awards").delete().eq("customer_id", MEMBER.id)
  await db()
    .from("milestone_awards")
    .insert([
      {
        customer_id: MEMBER.id,
        milestone_name: "E2E Chờ trao",
        threshold_amount: 1_000_000,
        spend_at_claim: 1_500_000,
      },
      {
        customer_id: MEMBER.id,
        milestone_name: "E2E Đã trao",
        threshold_amount: 2_000_000,
        spend_at_claim: 2_500_000,
        fulfilled_at: new Date().toISOString(),
      },
    ])

  await page.goto("/admin/milestones/awards?filter=pending")
  await expect(page.getByText("E2E Chờ trao").first()).toBeVisible()
  await expect(page.getByText("E2E Đã trao")).toHaveCount(0)

  await page.goto("/admin/milestones/awards")
  await expect(page.getByText("E2E Đã trao").first()).toBeVisible()
})
