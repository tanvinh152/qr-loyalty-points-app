import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import { db, setCustomer } from "./fixtures/db"
import { fillStable } from "./fixtures/hydration"

/**
 * `/profile` — the member's only write path onto their own record, and even
 * that goes through the `update_customer_profile` RPC (0007), service-role only
 * like every other write. Customers still have NO direct write access to
 * `public.customers`.
 *
 * The screen also carries the labelled sign-out that is the backstop now that
 * nothing else signs out in one click.
 */

const ORIGINAL = {
  full_name: MEMBER.fullName,
  date_of_birth: null,
  pet_name: null,
  pet_type: null,
  pet_dob: null,
  profile_completed_at: null,
}

test.beforeEach(async () => {
  await setCustomer(MEMBER.id, ORIGINAL)
})

test.afterAll(async () => {
  await setCustomer(MEMBER.id, ORIGINAL)
})

test("completing the profile saves every field and stamps it done", async ({
  page,
}) => {
  await page.goto("/profile")

  // A profile that has never been completed asks to be set up, not edited.
  await expect(
    page.getByRole("heading", { name: /thiết lập hồ sơ/i }),
  ).toBeVisible()

  await fillStable(page.locator("#full_name"), "Nguyễn Hồ Sơ")
  await fillStable(page.locator("#date_of_birth"), "1990-03-15")
  await fillStable(page.locator("#pet_name"), "Miu")
  // The pet type is a row of buttons, not a field — it is merged into the
  // payload by the form rather than posted.
  await page.getByRole("button", { name: /^mèo$/i }).click()
  await fillStable(page.locator("#pet_dob"), "2022-08-01")

  await page.getByRole("button", { name: /hoàn tất hồ sơ/i }).click()
  await expect(page.getByText(/đã lưu hồ sơ/i)).toBeVisible()

  const { data } = await db()
    .from("customers")
    .select(
      "full_name, date_of_birth, pet_name, pet_type, pet_dob, profile_completed_at",
    )
    .eq("id", MEMBER.id)
    .single()

  expect(data).toMatchObject({
    full_name: "Nguyễn Hồ Sơ",
    date_of_birth: "1990-03-15",
    pet_name: "Miu",
    pet_type: "cat",
    pet_dob: "2022-08-01",
  })
  expect(data!.profile_completed_at).not.toBeNull()

  // Once stamped, the screen changes what it calls itself.
  await page.reload()
  await expect(
    page.getByRole("heading", { name: /hồ sơ của bạn/i }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /lưu thay đổi/i }),
  ).toBeVisible()
})

test("the saved name is what the header greets the member by", async ({
  page,
}) => {
  await page.goto("/profile")
  await fillStable(page.locator("#full_name"), "Tên Mới Toanh")
  await page.getByRole("button", { name: /hoàn tất hồ sơ/i }).click()
  await expect(page.getByText(/đã lưu hồ sơ/i)).toBeVisible()

  await page.goto("/dashboard")
  await expect(page.getByText(/Tên Mới Toanh/).first()).toBeVisible()
})

test("the profile screen carries a labelled way out", async ({ page }) => {
  await page.goto("/profile")

  // The backstop: everything else about the account hides behind the avatar,
  // so this and the no-customer EmptyState are the only labelled sign-outs.
  const signOut = page.getByRole("button", { name: /đăng xuất/i })
  await expect(signOut.first()).toBeVisible()
})
