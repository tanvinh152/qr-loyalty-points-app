import { expect, test } from "@playwright/test"

import { db } from "./fixtures/db"
import { fillStable } from "./fixtures/hydration"

/**
 * `/admin/rewards` — ONE gift catalog.
 *
 * `public.rewards` holds all three kinds of gift keyed by `kind`: `redeem` (the
 * points shop), `spin` (a wheel wedge) and `milestone` (a rung of the spend
 * ladder). None of them is its own table. Check constraints stop each kind
 * squatting on the others' columns, and every shop query must pin
 * `kind = 'redeem'` — the invariant the last case here exists to guard.
 */

const MADE = "E2E Admin "

/**
 * Saves a dialog form and waits for the dialog to go.
 *
 * The write is a Server Action, so the row does not exist the moment the click
 * returns — reading the database straight after gives `null` and looks like a
 * save that silently did nothing. The dialog closing is the app's own signal
 * that the action resolved; a validation failure keeps it open, which is why
 * the conflict cases below assert on the message INSIDE it instead.
 */
async function save(dialog: import("@playwright/test").Locator) {
  await dialog.getByRole("button", { name: /^lưu$/i }).click()
  // Generous, because the action ends in `revalidatePath` and this suite runs
  // against `next dev`: the revalidated route is COMPILED on demand, which the
  // default 5s assertion budget loses to on a cold segment.
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

/** The card's pencil / bin, both of which carry an aria-label naming the row. */
const editButton = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("button", { name: `Sửa — ${name}` })
const deleteButton = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("button", { name: `Xóa — ${name}` })

async function purge() {
  const { error } = await db().from("rewards").delete().like("name", `${MADE}%`)
  if (error) throw new Error(`purge: ${error.message}`)
}

test.beforeEach(purge)
test.afterAll(purge)

test("a redeem gift is created and shows up in the shop", async ({ page }) => {
  await page.goto("/admin/rewards")

  await page.getByRole("button", { name: /thêm quà tặng/i }).click()
  const dialog = page.getByRole("dialog")

  await fillStable(dialog.locator('[name="name"]'), `${MADE}Vòng cổ`)
  await fillStable(dialog.locator('[name="points_cost"]'), "300")
  await fillStable(dialog.locator('[name="quantity"]'), "7")
  await save(dialog)

  await expect(page.getByText(`${MADE}Vòng cổ`).first()).toBeVisible()

  const { data } = await db()
    .from("rewards")
    .select("kind, points_cost, quantity, is_active")
    .eq("name", `${MADE}Vòng cổ`)
    .single()
  expect(data).toMatchObject({ kind: "redeem", points_cost: 300, quantity: 7 })
})

test("only one active gift may be featured", async ({ page }) => {
  // seed.sql already features "Túi cát 2,5kg"; a second one must be refused by
  // the partial unique index rather than quietly stealing the slot.
  const { error } = await db()
    .from("rewards")
    .insert({
      kind: "redeem",
      name: `${MADE}Ứng viên`,
      points_cost: 100,
      quantity: 5,
      is_active: true,
    })
  if (error) throw new Error(error.message)

  await page.goto("/admin/rewards")
  await editButton(page, `${MADE}Ứng viên`).click()

  const dialog = page.getByRole("dialog")
  await dialog.getByRole("checkbox", { name: /nổi bật/i }).click()
  await dialog.getByRole("button", { name: /^lưu$/i }).click()

  // The dialog deliberately stays open on a conflict — the admin has to turn
  // the other gift off first, and losing the form would lose that context.
  await expect(
    dialog.getByText(/đã có phần quà khác đang nổi bật/i),
  ).toBeVisible()
})

test("a spin wedge is created on its own tab", async ({ page }) => {
  await page.goto("/admin/rewards?kind=spin")

  await page.getByRole("button", { name: /thêm ô/i }).click()
  const dialog = page.getByRole("dialog")

  await fillStable(dialog.locator('[name="name"]'), `${MADE}Ô điểm`)
  // `prize_type` defaults to "Cộng điểm", and a points wedge that grants 0 is a
  // contradiction the check constraint refuses — so the amount is mandatory here
  // and meaningless on the other two types.
  await fillStable(dialog.locator('[name="points_amount"]'), "50")
  await fillStable(dialog.locator('[name="weight"]'), "5")
  await save(dialog)

  const { data } = await db()
    .from("rewards")
    .select("kind, weight, points_cost, prize_type")
    .eq("name", `${MADE}Ô điểm`)
    .single()
  // The server zeroes the columns that do not apply to a wedge and pins
  // points_cost to 0 — a wheel slice is not bought with points.
  expect(data).toMatchObject({
    kind: "spin",
    weight: 5,
    points_cost: 0,
    prize_type: "points",
  })
})

test("a milestone rung is created on its own tab", async ({ page }) => {
  await page.goto("/admin/rewards?kind=milestone")

  await page.getByRole("button", { name: /thêm cột mốc/i }).click()
  const dialog = page.getByRole("dialog")

  await fillStable(dialog.locator('[name="name"]'), `${MADE}Mốc mới`)
  // A round đồng amount, which is the ONLY kind anybody types. The input
  // carries `step="1000"`, and `min` has to sit on that grid: while it was
  // `min="1"` the browser held every such value invalid, and a form failing
  // native constraint validation never fires a submit event — so the dialog sat
  // open with no message and no request. Regression guard for that.
  await fillStable(dialog.locator('[name="spend_threshold"]'), "12345000")
  await save(dialog)

  const { data } = await db()
    .from("rewards")
    .select("kind, spend_threshold, points_cost")
    .eq("name", `${MADE}Mốc mới`)
    .single()
  expect(data!.kind).toBe("milestone")
  expect(Number(data!.spend_threshold)).toBe(12_345_000)
})

test("a rung seeded at a round amount can still be edited", async ({
  page,
}) => {
  // The seven rungs in seed.sql are all round thousands (400.000đ upwards). If
  // the threshold input ever drifts off its step grid again, none of them can
  // be re-saved from the UI — which is how the `min="1"` bug stayed invisible.
  await page.goto("/admin/rewards?kind=milestone")
  await editButton(page, "Súp/Pate").click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.locator('[name="spend_threshold"]')).toHaveValue("400000")
  await fillStable(dialog.locator('[name="description"]'), "E2E đã sửa")
  await save(dialog)

  const { data } = await db()
    .from("rewards")
    .select("description, spend_threshold")
    .eq("name", "Súp/Pate")
    .single()
  expect(data!.description).toBe("E2E đã sửa")
  expect(Number(data!.spend_threshold)).toBe(400_000)

  await db()
    .from("rewards")
    .update({ description: null })
    .eq("name", "Súp/Pate")
})

test("two active rungs cannot share a threshold", async ({ page }) => {
  const { error } = await db()
    .from("rewards")
    .insert({
      kind: "milestone",
      name: `${MADE}Mốc gốc`,
      points_cost: 0,
      spend_threshold: 7_777_000,
      is_active: true,
    })
  if (error) throw new Error(error.message)

  await page.goto("/admin/rewards?kind=milestone")
  await page.getByRole("button", { name: /thêm cột mốc/i }).click()
  const dialog = page.getByRole("dialog")

  await fillStable(dialog.locator('[name="name"]'), `${MADE}Mốc trùng`)
  await fillStable(dialog.locator('[name="spend_threshold"]'), "7777000")
  await dialog.getByRole("button", { name: /^lưu$/i }).click()

  await expect(dialog.getByText(/đã có|trùng/i).first()).toBeVisible()

  const { data } = await db()
    .from("rewards")
    .select("id")
    .eq("name", `${MADE}Mốc trùng`)
  expect(data).toHaveLength(0)
})

test("a wedge and a rung never leak into the members' shop", async ({
  page,
}) => {
  await db()
    .from("rewards")
    .insert([
      {
        kind: "spin",
        name: `${MADE}Ô bí mật`,
        points_cost: 0,
        weight: 1,
        is_active: true,
      },
      {
        kind: "milestone",
        name: `${MADE}Mốc bí mật`,
        points_cost: 0,
        spend_threshold: 9_999_000,
        is_active: true,
      },
    ])

  // THE invariant: one table, three kinds, and every shop query pins
  // `kind = 'redeem'`. A missed filter shows a wheel wedge for sale.
  await page.goto("/admin/rewards")
  await expect(page.getByText(`${MADE}Ô bí mật`)).toHaveCount(0)
  await expect(page.getByText(`${MADE}Mốc bí mật`)).toHaveCount(0)
})

test("deleting a gift asks first", async ({ page }) => {
  const { error } = await db()
    .from("rewards")
    .insert({
      kind: "redeem",
      name: `${MADE}Sắp xóa`,
      points_cost: 100,
      quantity: 1,
      is_active: true,
    })
  if (error) throw new Error(error.message)

  await page.goto("/admin/rewards")
  await deleteButton(page, `${MADE}Sắp xóa`).click()

  // Every admin delete sits behind an AlertDialog — the confirm is the feature.
  const confirm = page.getByRole("alertdialog")
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: /xóa/i }).click()

  await expect(page.getByText(`${MADE}Sắp xóa`)).toHaveCount(0)
})
