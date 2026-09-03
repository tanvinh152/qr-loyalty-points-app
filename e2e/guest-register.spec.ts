import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"
import { clearRateLimits, db } from "./fixtures/db"
import {
  maskOf,
  orderFixture,
  resetStub,
  stageOrder,
  stageOrderFailure,
  stageOrderMissing,
  stageCustomer,
  stubWrites,
} from "./pancake-stub"
import { fillStable } from "./fixtures/hydration"

/**
 * `/register` — the only way an account is ever created, and the only place the
 * app writes to Pancake.
 *
 * The order code is not a formality: it is the proof of phone ownership (the
 * server re-checks the typed number against the order's masked one) AND the
 * sole source of the POS customer id every later webhook attributes orders by.
 * An account that finishes signup without that link is invisible to the webhook
 * forever, which is why `linkPancakeCustomer` is the one "best-effort" step
 * that still aborts.
 *
 * Every order is served by `e2e/pancake-stub.ts`; nothing here touches the POS.
 */

// Never MEMBER's — these specs create accounts, and MEMBER must survive them.
const NEW = {
  phone: "0376733999",
  email: "e2e.signup@chicha.test",
  password: "signup-pw-1234",
  fullName: "Trần Đăng Ký",
  dob: "1994-05-20",
} as const

async function purgeSignupAccount() {
  const admin = db()
  const { data } = await admin
    .from("customers")
    .select("auth_user_id")
    .eq("phone", NEW.phone)
    .maybeSingle()

  await admin.from("transactions").delete().eq("phone", NEW.phone)
  await admin.from("customers").delete().eq("phone", NEW.phone)

  // The auth user outlives its customers row, and a leftover one turns the next
  // run's "email taken" case into a false pass.
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const user of users?.users ?? []) {
    if (user.email === NEW.email || user.id === data?.auth_user_id) {
      await admin.auth.admin.deleteUser(user.id)
    }
  }
}

async function fillSignup(
  page: import("@playwright/test").Page,
  overrides: Partial<Record<string, string>> = {},
) {
  const values: Record<string, string> = {
    full_name: NEW.fullName,
    email: NEW.email,
    date_of_birth: NEW.dob,
    phone: NEW.phone,
    password: NEW.password,
    ...overrides,
  }
  for (const [field, value] of Object.entries(values)) {
    await fillStable(page.locator(`#${field}`), value)
  }
  await page.locator("#terms").click()
}

test.beforeEach(async ({ page }) => {
  await resetStub()
  await clearRateLimits()
  await purgeSignupAccount()
  await page.goto("/register")
})

test.afterAll(async () => {
  await purgeSignupAccount()
  await clearRateLimits()
  // The "already linked" case parks a POS id on MEMBER; leaving it there would
  // hand the next spec file a member linked to an order it knows nothing about.
  await db()
    .from("customers")
    .update({ pancake_customer_id: null })
    .eq("id", MEMBER.id)
})

test("a valid order code creates the account and links it to the POS", async ({
  page,
}) => {
  // The order carries only a MASK, the state a marketplace order really arrives
  // in — so this exercises matchesMask, not the exact-match shortcut.
  await stageOrder(
    "SIGNUP-OK",
    orderFixture({
      id: "SIGNUP-OK",
      total_price_after_sub_discount: 400_000,
      customer: {
        customer_id: "pos-cus-signup",
        phone_numbers: [maskOf(NEW.phone)],
      },
    }),
  )

  // The POS record the write-back targets. Both fields masked, so the shop has
  // nothing real and the sync has something to fill in.
  await stageCustomer("pos-cus-signup", {
    id: "pos-cus-signup",
    customer_id: "pos-cus-signup",
    name: "T******ý",
    phone_numbers: [maskOf(NEW.phone)],
  })

  await fillSignup(page)
  await fillStable(page.locator("#order_code"), "SIGNUP-OK")
  await page.getByRole("button", { name: /đăng ký/i }).click()

  await page.waitForURL("**/dashboard")

  const { data: customer } = await db()
    .from("customers")
    .select(
      "phone, email, full_name, pancake_customer_id, lifetime_spend, current_points",
    )
    .eq("phone", NEW.phone)
    .single()

  expect(customer).toBeTruthy()
  expect(customer!.pancake_customer_id).toBe("pos-cus-signup")
  expect(customer!.full_name).toBe(NEW.fullName)
  expect(customer!.email).toBe(NEW.email)
  // The proof order is claimed like any other: 400.000đ / 1.000 at x1.
  expect(Number(customer!.lifetime_spend)).toBe(400_000)
  expect(customer!.current_points).toBe(400)

  // The app's ONE legitimate write to Pancake: the POS knew only a mask, so the
  // real name and number are pushed back so staff have someone to call.
  const writes = await stubWrites()
  expect(writes).toHaveLength(1)
  expect(writes[0].customerId).toBe("pos-cus-signup")
  // `phone_numbers` is a whole-array replace on the wire, so the real number is
  // APPENDED to the masks rather than replacing them — dropping them would
  // rewrite history for a record we only ever see through a mask.
  expect(writes[0].body).toEqual({
    customer: {
      id: "pos-cus-signup",
      name: NEW.fullName,
      phone_numbers: [maskOf(NEW.phone), NEW.phone],
    },
  })
})

test("nothing is written back when the shop already knows the member", async ({
  page,
}) => {
  await stageOrder(
    "SIGNUP-KNOWN",
    orderFixture({
      id: "SIGNUP-KNOWN",
      customer: {
        customer_id: "pos-cus-known",
        // A REAL number on the order, so the ownership gate takes the
        // exact-match path and ignores any mask beside it.
        phone_numbers: [maskOf(NEW.phone), NEW.phone],
      },
    }),
  )
  await stageCustomer("pos-cus-known", {
    id: "pos-cus-known",
    customer_id: "pos-cus-known",
    name: "Trần Đăng Ký",
    phone_numbers: [NEW.phone],
  })

  await fillSignup(page)
  await fillStable(page.locator("#order_code"), "SIGNUP-KNOWN")
  await page.getByRole("button", { name: /đăng ký/i }).click()
  await page.waitForURL("**/dashboard")

  // The shop knows better than a signup form: when nothing is missing, no
  // request is sent at all.
  expect(await stubWrites()).toEqual([])
})

test("an order the shop has never seen is refused", async ({ page }) => {
  await stageOrderMissing("SIGNUP-GHOST")

  await fillSignup(page)
  await fillStable(page.locator("#order_code"), "SIGNUP-GHOST")
  await page.getByRole("button", { name: /đăng ký/i }).click()

  await expect(page.getByText(/không khớp với số điện thoại/i)).toBeVisible()
  await expect(page).toHaveURL(/\/register/)
})

test("an order belonging to a different phone is refused", async ({ page }) => {
  await stageOrder(
    "SIGNUP-OTHER",
    orderFixture({
      id: "SIGNUP-OTHER",
      customer: {
        customer_id: "pos-cus-other",
        phone_numbers: [maskOf("0912345678")],
      },
    }),
  )

  await fillSignup(page)
  await fillStable(page.locator("#order_code"), "SIGNUP-OTHER")
  await page.getByRole("button", { name: /đăng ký/i }).click()

  // Deliberately the SAME message as an unknown order: telling the two apart
  // would leak whether the shop already knows a given number.
  await expect(page.getByText(/không khớp với số điện thoại/i)).toBeVisible()
  expect(await stubWrites()).toEqual([])
})

test("an order with no POS customer cannot back an account", async ({
  page,
}) => {
  await stageOrder(
    "SIGNUP-NOLINK",
    orderFixture({
      id: "SIGNUP-NOLINK",
      customer: { customer_id: null, phone_numbers: [maskOf(NEW.phone)] },
    }),
  )

  await fillSignup(page)
  await fillStable(page.locator("#order_code"), "SIGNUP-NOLINK")
  await page.getByRole("button", { name: /đăng ký/i }).click()

  // Without the id the webhook could never attribute a future order, so the
  // signup is refused rather than producing an account that can never earn.
  await expect(page.getByText(/chưa có hồ sơ khách hàng/i)).toBeVisible()
})

test("an order already claimed by another member is refused", async ({
  page,
}) => {
  // MEMBER already owns this POS customer.
  await db()
    .from("customers")
    .update({ pancake_customer_id: "pos-cus-taken" })
    .eq("id", MEMBER.id)

  await stageOrder(
    "SIGNUP-TAKEN",
    orderFixture({
      id: "SIGNUP-TAKEN",
      customer: {
        customer_id: "pos-cus-taken",
        phone_numbers: [maskOf(NEW.phone)],
      },
    }),
  )

  await fillSignup(page)
  await fillStable(page.locator("#order_code"), "SIGNUP-TAKEN")
  await page.getByRole("button", { name: /đăng ký/i }).click()

  await expect(page.getByText(/đã thuộc về một tài khoản/i)).toBeVisible()

  // Nothing was created — the gate runs before the auth user exists.
  const { data } = await db()
    .from("customers")
    .select("id")
    .eq("phone", NEW.phone)
    .maybeSingle()
  expect(data).toBeNull()
})

test("a POS outage is not the member's fault, and does not cost them an attempt", async ({
  page,
}) => {
  await stageOrderFailure("SIGNUP-DOWN", 503)

  await fillSignup(page)
  await fillStable(page.locator("#order_code"), "SIGNUP-DOWN")
  await page.getByRole("button", { name: /đăng ký/i }).click()

  await expect(page.getByText(/hệ thống đang gặp sự cố/i)).toBeVisible()

  // The distinction that matters: an outage must not burn one of the five
  // attempts, or our own misconfiguration locks a real member out.
  const { data } = await db()
    .from("claim_attempts")
    .select("id")
    .eq("order_code", "SIGNUP-DOWN")
  expect(data).toHaveLength(0)
})

test("a phone that already has an account is refused", async ({ page }) => {
  await stageOrder(
    "SIGNUP-DUPPHONE",
    orderFixture({
      id: "SIGNUP-DUPPHONE",
      customer: {
        customer_id: "pos-cus-dupphone",
        phone_numbers: [maskOf(MEMBER.phone)],
      },
    }),
  )

  await fillSignup(page, { phone: MEMBER.phone, email: "e2e.dup@chicha.test" })
  await fillStable(page.locator("#order_code"), "SIGNUP-DUPPHONE")
  await page.getByRole("button", { name: /đăng ký/i }).click()

  await expect(
    page.getByText(/số điện thoại này đã được đăng ký/i),
  ).toBeVisible()
})

test("a password under eight characters never reaches the server", async ({
  page,
}) => {
  await fillSignup(page, { password: "short" })
  await fillStable(page.locator("#order_code"), "SIGNUP-SHORT")
  await page.getByRole("button", { name: /đăng ký/i }).click()

  await expect(page).toHaveURL(/\/register/)
  // Nothing was staged, so a request that got as far as Pancake would have
  // failed differently — no account, and no attempt booked.
  const { data } = await db()
    .from("customers")
    .select("id")
    .eq("phone", NEW.phone)
    .maybeSingle()
  expect(data).toBeNull()
})

test("the sixth attempt on one order code is throttled", async ({ page }) => {
  // Six full form fills through the hydration-retry helper; the default 30s
  // budget is for a single interaction, not a loop of them.
  test.setTimeout(180_000)

  await stageOrder(
    "SIGNUP-BRUTE",
    orderFixture({
      id: "SIGNUP-BRUTE",
      customer: {
        customer_id: "pos-cus-brute",
        phone_numbers: [maskOf("0912345678")],
      },
    }),
  )

  // Five genuine failures — wrong phone for this order — then the budget is out.
  for (let i = 0; i < 5; i++) {
    await page.goto("/register")
    await fillSignup(page)
    await fillStable(page.locator("#order_code"), "SIGNUP-BRUTE")
    await page.getByRole("button", { name: /đăng ký/i }).click()
    await expect(page.getByText(/không khớp với số điện thoại/i)).toBeVisible()
  }

  await page.goto("/register")
  await fillSignup(page)
  await fillStable(page.locator("#order_code"), "SIGNUP-BRUTE")
  await page.getByRole("button", { name: /đăng ký/i }).click()

  await expect(page.getByText(/quá nhiều lần thử/i)).toBeVisible()
})
