/**
 * The two identities every spec runs as. Provisioned by `e2e/global-setup.ts`
 * through the service-role client — the same `auth.admin.createUser` call
 * production signup makes, so these accounts are indistinguishable from real
 * ones.
 *
 * `MEMBER_B` exists only so the "A cannot see B" cases have something to fail
 * on. A test that asserts an absence against an empty database asserts nothing.
 */

export const ADMIN = {
  email: "e2e.admin@chicha.test",
  password: "e2e-admin-pw-9137",
} as const

export const MEMBER = {
  id: "e2e0a001-0000-4000-8000-000000000001",
  authId: "e2e0b001-0000-4000-8000-000000000001",
  phone: "0900000101",
  email: "e2e.member@chicha.test",
  password: "e2e-member-pw-9137",
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
