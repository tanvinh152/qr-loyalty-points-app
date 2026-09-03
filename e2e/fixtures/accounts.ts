/**
 * The two identities every spec runs as. Provisioned by `e2e/global-setup.ts`
 * through the service-role client — the same `auth.admin.createUser` call
 * production signup makes, so these accounts are indistinguishable from real
 * ones.
 *
 * `MEMBER_B` exists only so the "A cannot see B" cases have something to fail
 * on. A test that asserts an absence against an empty database asserts nothing.
 */

/**
 * ADMIN and MEMBER are the project's documented dev identities
 * (`docs/account-test.md`), so a developer can sign in by hand and see exactly
 * the state a failing spec left behind.
 *
 * `admin`'s five characters are below `config.toml`'s
 * `minimum_password_length = 6`, and that is fine: the limit governs SELF-signup
 * through `/auth/v1/signup`. `auth.admin.createUser` — what global setup calls —
 * does not enforce it, and `/admin/login` runs no length check of its own
 * (`src/app/admin/login/actions.ts` only tests for emptiness). Verified against
 * the local stack. The member's password is 9 characters and clears the
 * `.min(8)` in `makeCustomerLoginSchema` (`src/lib/schemas.ts:65`) that the
 * sign-in FORM does enforce.
 */
export const ADMIN = {
  email: "admin@gmail.com",
  password: "admin",
} as const

export const MEMBER = {
  id: "e2e0a001-0000-4000-8000-000000000001",
  authId: "e2e0b001-0000-4000-8000-000000000001",
  phone: "0376733152",
  // Supabase Auth is email-keyed, so `signIn` resolves phone -> customers.email
  // before `signInWithPassword` (0014). The member logs in with the phone; this
  // address only ever exists to satisfy that lookup.
  email: "member@gmail.com",
  password: "123123123",
  fullName: "Nguyễn Test Một",
} as const

export const MEMBER_B = {
  id: "e2e0a002-0000-4000-8000-000000000002",
  authId: "e2e0b002-0000-4000-8000-000000000002",
  phone: "0900000102",
  email: "e2e.other@chicha.test",
  password: "e2e-other-pw-9137",
  fullName: "Trần Test Hai",
} as const

/** A phone that has never been registered — used for the enumeration check. */
export const UNKNOWN_PHONE = "0900000999"

/** The shop reward the redemption specs drive. Created by global setup. */
export const TEST_REWARD = {
  id: "e2e0c001-0000-4000-8000-000000000001",
  name: "E2E Voucher",
  pointsCost: 500,
} as const

export const STORAGE = {
  member: "e2e/.auth/member.json",
  admin: "e2e/.auth/admin.json",
} as const
