import { beforeEach, describe, expect, it, vi } from "vitest"

import { PancakeRequestError } from "@/lib/pancake/types"

// signUp is where a phone is proved, an auth user is minted and the POS link
// that every future webhook depends on is written. The interesting cases are all
// failures: which ones charge the customer's rate-limit budget, which ones leave
// an account behind, and which ones must never be mistaken for one another.

const getOrder = vi.fn()
const updateCustomer = vi.fn()
const getCustomerByPancakeId = vi.fn()
const getCustomerByPhone = vi.fn()
const linkAuthUserToPhone = vi.fn()
const linkPancakeCustomer = vi.fn()
const getActiveSettings = vi.fn()
const isRateLimited = vi.fn()
const recordAttempt = vi.fn()
const createUser = vi.fn()
const deleteUser = vi.fn()
const updateUserById = vi.fn()
const adminRpc = vi.fn()
// signUp now talks to two RPCs, and the orphan one runs FIRST on every attempt —
// so each needs its own reply. `adminRpc` stays the call recorder.
const findOrphan = vi.fn()
const claimPoints = vi.fn()
const signInWithPassword = vi.fn()
const redirect = vi.fn()

// Every message resolves to its own key, so assertions name the outcome rather
// than the shipped copy — the same trick schemas.test.ts uses. Only the two
// branches signUp actually reads need to exist.
const messages = {
  validation: new Proxy({}, { get: (_t, key) => String(key) }),
  customer: { errors: new Proxy({}, { get: (_t, key) => String(key) }) },
}

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirect(path)
    // The real redirect throws to unwind; mimic it so nothing runs after.
    throw new Error("NEXT_REDIRECT")
  },
}))

vi.mock("@/lib/i18n/server", () => ({ getMessages: async () => messages }))

vi.mock("@/lib/pancake/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/pancake/client")>(
      "@/lib/pancake/client",
    )
  return {
    ...actual,
    getOrder: (...a: unknown[]) => getOrder(...a),
    updateCustomer: (...a: unknown[]) => updateCustomer(...a),
  }
})

vi.mock("@/lib/loyalty", () => ({
  getActiveSettings: () => getActiveSettings(),
  getCustomerByAuthUserId: async () => null,
  getCustomerByPancakeId: (id: string) => getCustomerByPancakeId(id),
  getCustomerByPhone: (...a: unknown[]) => getCustomerByPhone(...a),
  linkAuthUserToPhone: (...a: unknown[]) => linkAuthUserToPhone(...a),
  linkPancakeCustomer: (...a: unknown[]) => linkPancakeCustomer(...a),
}))

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: async () => "203.0.113.9",
  isRateLimited: (...a: unknown[]) => isRateLimited(...a),
  recordAttempt: (...a: unknown[]) => recordAttempt(...a),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: (...a: unknown[]) => createUser(...a),
        deleteUser: (...a: unknown[]) => deleteUser(...a),
        updateUserById: (...a: unknown[]) => updateUserById(...a),
      },
    },
    rpc: (...a: unknown[]) => adminRpc(...a),
  }),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword: (...a: unknown[]) => signInWithPassword(...a) },
  }),
}))

vi.mock("@/lib/theme/actions", () => ({ setThemeCookie: async () => {} }))
vi.mock("@/lib/theme/server", () => ({ getTheme: async () => null }))

const { signIn, signUp } = await import("./actions")

const PHONE = "0901234570"
const EMAIL = "member@example.com"

// A real order carries a masked phone; the visible "0…70" is what proves
// ownership of PHONE.
const ORDER = {
  id: "ORDER-1",
  system_id: 1,
  status: 3,
  items: [{ quantity: 1, variation_info: { display_id: "SKU-1" } }],
  total_price: 500_000,
  bill_phone_number: "0****70",
  customer: { customer_id: "pos-1", phone_numbers: ["0****70"] },
}

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  const fields: Record<string, string> = {
    phone: PHONE,
    password: "hunter2hunter2",
    email: EMAIL,
    full_name: "Nguyễn Văn A",
    date_of_birth: "1995-04-02",
    terms: "on",
    order_code: "ORDER-1",
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

/** Runs signUp, converting the redirect-throw of a success into a marker. */
async function run(fd: FormData = form()) {
  try {
    // The action's own idle state; useActionState passes the previous result.
    return await signUp({ error: "" }, fd)
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") {
      return { redirected: true as const }
    }
    throw err
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})

  isRateLimited.mockResolvedValue(false)
  recordAttempt.mockResolvedValue(undefined)
  getOrder.mockResolvedValue(ORDER)
  getCustomerByPancakeId.mockResolvedValue(null)
  createUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null })
  deleteUser.mockResolvedValue({ error: null })
  updateUserById.mockResolvedValue({ error: null })
  getCustomerByPhone.mockResolvedValue({
    id: "cust-1",
    phone: PHONE,
    email: EMAIL,
  })
  linkAuthUserToPhone.mockResolvedValue({
    ok: true,
    customer: { id: "cust-1", phone: PHONE },
  })
  linkPancakeCustomer.mockResolvedValue({ ok: true })
  getActiveSettings.mockResolvedValue({
    rounding: "floor",
    vnd_per_point: 1000,
    claimable_statuses: [3, 16],
  })
  findOrphan.mockResolvedValue({ data: null, error: null })
  claimPoints.mockResolvedValue({ data: null, error: null })
  adminRpc.mockImplementation(async (fn: string) => {
    if (fn === "find_orphan_auth_user") return findOrphan()
    if (fn === "claim_points") return claimPoints()
    return { data: null, error: null }
  })
  updateCustomer.mockResolvedValue("updated")
  signInWithPassword.mockResolvedValue({
    data: { user: { id: "auth-1" } },
    error: null,
  })
})

describe("signUp — the happy path", () => {
  it("links the POS customer and signs the member in", async () => {
    const result = await run()
    expect(result).toEqual({ redirected: true })
    expect(linkPancakeCustomer).toHaveBeenCalledWith("cust-1", "pos-1")
    expect(recordAttempt).toHaveBeenLastCalledWith(
      "203.0.113.9",
      "ORDER-1",
      true,
    )
  })
})

// The order-code budget existed in rate-limit.ts but no caller ever passed a
// code, so only the IP limit was live and the whole second limit was dead code.
describe("signUp — rate limiting", () => {
  it("charges the order-code budget as well as the IP one", async () => {
    await run()
    expect(isRateLimited).toHaveBeenCalledWith("203.0.113.9", "ORDER-1")
  })

  it("records failed attempts against the typed code, not against null", async () => {
    getOrder.mockRejectedValueOnce(new PancakeRequestError("not_found"))
    await run()
    expect(recordAttempt).toHaveBeenCalledWith("203.0.113.9", "ORDER-1", false)
  })

  it("refuses before calling Pancake when over budget", async () => {
    isRateLimited.mockResolvedValueOnce(true)
    expect(await run()).toEqual({ error: "rateLimited" })
    expect(getOrder).not.toHaveBeenCalled()
  })
})

// A misconfigured API key used to look exactly like a wrong order code, so our
// own outage burned one of the customer's five attempts — five bad deploys and
// a real member is locked out for fifteen minutes.
describe("signUp — Pancake failures are not the customer's fault", () => {
  it("does not charge an attempt when Pancake is misconfigured or down", async () => {
    for (const kind of ["unauthorized", "unavailable", "malformed"] as const) {
      vi.clearAllMocks()
      isRateLimited.mockResolvedValue(false)
      getOrder.mockRejectedValueOnce(new PancakeRequestError(kind))

      expect(await run(), kind).toEqual({ error: "serviceUnavailable" })
      expect(recordAttempt, kind).not.toHaveBeenCalled()
    }
  })

  it("still charges an attempt for an order code that does not exist", async () => {
    getOrder.mockRejectedValueOnce(new PancakeRequestError("not_found"))
    expect(await run()).toEqual({ error: "proofFailed" })
    expect(recordAttempt).toHaveBeenCalledWith("203.0.113.9", "ORDER-1", false)
  })
})

// The takeover gate. It used to read a swallowed DB error as "nobody is
// linked" — failing open on the one check that stops an account being claimed
// by someone else.
describe("signUp — the already-linked gate", () => {
  it("stops on a lookup failure instead of letting the signup through", async () => {
    getCustomerByPancakeId.mockRejectedValueOnce(new Error("connection reset"))
    expect(await run()).toEqual({ error: "serviceUnavailable" })
    expect(createUser).not.toHaveBeenCalled()
    expect(recordAttempt).not.toHaveBeenCalled()
  })

  it("refuses an order already backing another member", async () => {
    getCustomerByPancakeId.mockResolvedValueOnce({
      id: "cust-9",
      phone: "0909999999",
    })
    expect(await run()).toEqual({ error: "orderAlreadyLinked" })
    expect(createUser).not.toHaveBeenCalled()
  })

  it("lets the same member re-register against their own POS record", async () => {
    getCustomerByPancakeId.mockResolvedValueOnce({ id: "cust-1", phone: PHONE })
    expect(await run()).toEqual({ redirected: true })
  })
})

// Losing the race here means the account exists but is invisible to the
// webhook forever, which used to happen silently.
describe("signUp — writing the POS link", () => {
  it("rolls the account back when another signup won the race", async () => {
    linkPancakeCustomer.mockResolvedValueOnce({ ok: false, reason: "conflict" })
    expect(await run()).toEqual({ error: "orderAlreadyLinked" })
    expect(deleteUser).toHaveBeenCalledWith("auth-1")
  })

  it("rolls back when the row already points at a different POS customer", async () => {
    linkPancakeCustomer.mockResolvedValueOnce({ ok: false, reason: "mismatch" })
    expect(await run()).toEqual({ error: "orderAlreadyLinked" })
    expect(deleteUser).toHaveBeenCalledWith("auth-1")
  })

  it("reports a link write error as our fault, not theirs", async () => {
    linkPancakeCustomer.mockResolvedValueOnce({ ok: false, reason: "error" })
    expect(await run()).toEqual({ error: "serviceUnavailable" })
  })

  it("does not delete an adopted account it did not create", async () => {
    findOrphan.mockResolvedValueOnce({ data: "auth-orphan", error: null })
    linkPancakeCustomer.mockResolvedValueOnce({ ok: false, reason: "conflict" })

    expect(await run()).toEqual({ error: "orderAlreadyLinked" })
    expect(deleteUser).not.toHaveBeenCalled()
  })
})

// The address is now the credential Supabase actually sees, so it has to reach
// auth.users AND customers.email — a row where those two disagree cannot be
// signed into at all.
describe("signUp — the email", () => {
  it("rejects a malformed address before anything is created", async () => {
    expect(await run(form({ email: "not-an-email" }))).toEqual({
      error: "invalidEmail",
    })
    expect(isRateLimited).not.toHaveBeenCalled()
    expect(getOrder).not.toHaveBeenCalled()
    expect(createUser).not.toHaveBeenCalled()
  })

  it("rejects a missing address", async () => {
    expect(await run(form({ email: "" }))).toEqual({ error: "emailRequired" })
    expect(createUser).not.toHaveBeenCalled()
  })

  it("mints the auth user with the typed address, lower-cased", async () => {
    expect(await run(form({ email: "Member@Example.COM" }))).toEqual({
      redirected: true,
    })
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL, user_metadata: { phone: PHONE } }),
    )
  })

  it("writes the same address to the customers row unconditionally", async () => {
    // Not settled yet, so claim_points is skipped — the link write is the only
    // thing left that can persist the address.
    getOrder.mockResolvedValueOnce({ ...ORDER, status: 0 })
    expect(await run()).toEqual({ redirected: true })
    expect(linkAuthUserToPhone).toHaveBeenCalledWith("auth-1", PHONE, EMAIL)
  })

  it("reports a duplicate address as emailTaken, not as phoneTaken", async () => {
    createUser.mockResolvedValueOnce({
      data: null,
      error: { code: "email_exists", message: "User already registered" },
    })
    expect(await run()).toEqual({ error: "emailTaken" })
    expect(deleteUser).not.toHaveBeenCalled()
    expect(recordAttempt).toHaveBeenCalledWith("203.0.113.9", "ORDER-1", false)
  })
})

// A signup that died before linking leaves an auth user with no customers row.
// It is found by PHONE, so a member who retries with a corrected address is
// still recognised as the same person.
describe("signUp — adopting an orphaned auth user", () => {
  it("looks the orphan up by phone before creating anything", async () => {
    await run()
    expect(adminRpc).toHaveBeenCalledWith("find_orphan_auth_user", {
      p_phone: PHONE,
    })
  })

  it("adopts with the new address instead of minting a second user", async () => {
    findOrphan.mockResolvedValueOnce({ data: "auth-orphan", error: null })
    expect(await run(form({ email: "second-try@example.com" }))).toEqual({
      redirected: true,
    })
    expect(createUser).not.toHaveBeenCalled()
    expect(updateUserById).toHaveBeenCalledWith(
      "auth-orphan",
      expect.objectContaining({ email: "second-try@example.com" }),
    )
  })

  it("refuses when the retry's address belongs to someone else", async () => {
    findOrphan.mockResolvedValueOnce({ data: "auth-orphan", error: null })
    updateUserById.mockResolvedValueOnce({
      error: { code: "email_exists", message: "User already registered" },
    })
    expect(await run()).toEqual({ error: "emailTaken" })
  })
})

describe("signUp — proving the phone", () => {
  it("refuses a phone the order does not carry", async () => {
    const result = await run(form({ phone: "0901234599" }))
    expect(result).toEqual({ error: "proofFailed" })
    expect(createUser).not.toHaveBeenCalled()
  })

  it("refuses an order with no POS customer to link", async () => {
    getOrder.mockResolvedValueOnce({ ...ORDER, customer: undefined })
    expect(await run()).toEqual({ error: "orderNotLinkable" })
  })

  it("rejects a phone that is not a Vietnamese mobile before anything else", async () => {
    expect(await run(form({ phone: "901234570" }))).toEqual({
      error: "invalidPhone",
    })
    expect(isRateLimited).not.toHaveBeenCalled()
  })
})

// 0018: a one-time signup bonus, amount configured by the admin. Best-effort
// like everything else once the account is real.
describe("signUp — the welcome gift", () => {
  it("grants it for the linked customer", async () => {
    expect(await run()).toEqual({ redirected: true })
    expect(adminRpc).toHaveBeenCalledWith("grant_welcome_gift", {
      p_customer_id: "cust-1",
    })
  })

  it("does not block a completed signup when the grant fails", async () => {
    adminRpc.mockImplementation(async (fn: string) => {
      if (fn === "find_orphan_auth_user") return findOrphan()
      if (fn === "claim_points") return claimPoints()
      if (fn === "grant_welcome_gift") return { data: null, error: { code: "XX000" } }
      return { data: null, error: null }
    })
    expect(await run()).toEqual({ redirected: true })
  })
})

describe("signUp — claiming the proof order", () => {
  it("skips the claim when the order has not reached a claimable status", async () => {
    getOrder.mockResolvedValueOnce({ ...ORDER, status: 0 })
    expect(await run()).toEqual({ redirected: true })
    expect(adminRpc).not.toHaveBeenCalledWith(
      "claim_points",
      expect.anything(),
    )
    // Still linked: every later order must be attributable.
    expect(linkPancakeCustomer).toHaveBeenCalledWith("cust-1", "pos-1")
  })

  it("completes the signup even when the claim was already taken", async () => {
    claimPoints.mockResolvedValueOnce({ data: null, error: { code: "P0002" } })
    expect(await run()).toEqual({ redirected: true })
  })
})

// The login form still has one field. The phone is a LOOKUP key now, not a
// credential — an unknown number must be indistinguishable from a wrong password.
describe("signIn", () => {
  function loginForm(overrides: Record<string, string> = {}) {
    const fd = new FormData()
    const fields: Record<string, string> = {
      phone: PHONE,
      password: "hunter2hunter2",
      ...overrides,
    }
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    return fd
  }

  async function login(fd: FormData = loginForm()) {
    try {
      return await signIn({ error: "" }, fd)
    } catch (err) {
      if (err instanceof Error && err.message === "NEXT_REDIRECT") {
        return { redirected: true as const }
      }
      throw err
    }
  }

  it("signs in with the address stored against that phone", async () => {
    expect(await login()).toEqual({ redirected: true })
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: EMAIL,
      password: "hunter2hunter2",
    })
  })

  it("answers an unregistered phone exactly like a wrong password", async () => {
    getCustomerByPhone.mockResolvedValueOnce(null)
    expect(await login()).toEqual({ error: "invalidCredentials" })
    expect(signInWithPassword).not.toHaveBeenCalled()
    // Still charged, so the lookup cannot be used as a free membership oracle.
    expect(recordAttempt).toHaveBeenCalledWith("203.0.113.9", null, false)
  })

  it("does the same for a row that has no address yet", async () => {
    getCustomerByPhone.mockResolvedValueOnce({ id: "cust-1", phone: PHONE })
    expect(await login()).toEqual({ error: "invalidCredentials" })
    expect(signInWithPassword).not.toHaveBeenCalled()
  })
})
