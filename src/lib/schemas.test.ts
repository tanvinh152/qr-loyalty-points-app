import { describe, expect, it } from "vitest"

import type { Messages } from "@/lib/i18n/messages"
import {
  makeAdjustSchema,
  makeCustomerSignupSchema,
  makeLoyaltySettingsSchema,
  makePhoneSchema,
  makeProfileSchema,
  makeRewardSchema,
  makeTierScheduleSchema,
} from "./schemas"

// Every message resolves to its own key, so assertions name the *rule* that
// fired rather than the shipped Vietnamese copy. A wording change then cannot
// break a test, but swapping two messages still does.
const v = new Proxy({} as Messages["validation"], {
  get: (_target, key) => String(key),
})

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301"

/** The rule that fired, plus where it was reported. */
function issues(result: { success: boolean; error?: { issues: readonly unknown[] } }) {
  if (result.success) return []
  return (result.error?.issues ?? []).map((raw) => {
    const issue = raw as { message: string; path: PropertyKey[] }
    return { message: issue.message, path: issue.path.join(".") }
  })
}

describe("makePhoneSchema", () => {
  const schema = makePhoneSchema(v)

  // The schema now OUTPUTS the normalized number rather than what was typed.
  // That is what keeps one person to one `customers.phone` row — the key sign-in
  // looks their address up by; callers may still normalize again, since doing so
  // is idempotent.
  it("returns the normalized number, not the typed string", () => {
    for (const typed of ["+84 90 123 4567", "84901234567", "090-123-4567"]) {
      const result = schema.safeParse({ phone: typed })
      expect(result.success && result.data.phone, typed).toBe("0901234567")
    }
  })

  it("rejects a number that is not a Vietnamese mobile", () => {
    const result = schema.safeParse({ phone: "901234567" })
    expect(issues(result)).toContainEqual({
      message: "invalidPhone",
      path: "phone",
    })
  })
})

// The signup email is the account's auth identity, so a typo is not a cosmetic
// problem: it is the address the member will have to sign in with forever.
describe("makeCustomerSignupSchema", () => {
  const schema = makeCustomerSignupSchema(v)
  const base = {
    phone: "0901234567",
    password: "hunter2hunter2",
    email: "member@example.com",
    full_name: "Nguyễn Văn A",
    date_of_birth: "1995-04-02",
    terms: true,
    order_code: "ORDER-1",
  }

  it("lower-cases and trims the address", () => {
    const result = schema.safeParse({ ...base, email: "  Member@Example.COM " })
    expect(result.success && result.data.email).toBe("member@example.com")
  })

  it("rejects a malformed address", () => {
    expect(issues(schema.safeParse({ ...base, email: "member@" }))).toContainEqual(
      { message: "invalidEmail", path: "email" },
    )
  })

  it("rejects a blank address", () => {
    expect(issues(schema.safeParse({ ...base, email: "   " }))).toContainEqual({
      message: "emailRequired",
      path: "email",
    })
  })
})

describe("makeLoyaltySettingsSchema", () => {
  const schema = makeLoyaltySettingsSchema(v)
  const base = {
    rounding: "floor" as const,
    unmapped_sku_points: 0,
    welcome_gift_points: 0,
    checkin_points: 0,
  }

  it("parses the admin's free-text status list into integers", () => {
    const result = schema.safeParse({ ...base, claimable_statuses: "3, 16" })
    expect(result.success && result.data.claimable_statuses).toEqual([3, 16])
  })

  it("tolerates stray whitespace around a single status", () => {
    const result = schema.safeParse({ ...base, claimable_statuses: "  3  " })
    expect(result.success && result.data.claimable_statuses).toEqual([3])
  })

  it("rejects a non-numeric status", () => {
    const result = schema.safeParse({ ...base, claimable_statuses: "3,x" })
    expect(issues(result)).toContainEqual({
      message: "invalidStatuses",
      path: "claimable_statuses",
    })
  })

  it("rejects an empty list", () => {
    expect(schema.safeParse({ ...base, claimable_statuses: "" }).success).toBe(
      false,
    )
  })

  // A trailing comma used to yield a phantom status 0 — `Number("")` is 0, not
  // NaN — and 0 is Pancake's "new", so "3," quietly made brand-new unpaid orders
  // claimable. Empty segments are now dropped before parsing.
  it("ignores a trailing comma instead of reading it as status 0", () => {
    const result = schema.safeParse({ ...base, claimable_statuses: "3," })
    expect(result.success && result.data.claimable_statuses).toEqual([3])
  })

  it("keeps a list usable when the admin leaves a gap between commas", () => {
    const result = schema.safeParse({ ...base, claimable_statuses: "3, ,16" })
    expect(result.success && result.data.claimable_statuses).toEqual([3, 16])
  })

  // Statuses are a closed set from Pancake; a typo is a setting that silently
  // matches nothing, so it is rejected at the form rather than at claim time.
  it("rejects a status Pancake does not define", () => {
    const result = schema.safeParse({ ...base, claimable_statuses: "3,999" })
    expect(issues(result)).toContainEqual({
      message: "invalidStatuses",
      path: "claimable_statuses",
    })
  })
})

describe("makeTierScheduleSchema", () => {
  const schema = makeTierScheduleSchema(v)
  const base = {
    tier_id: UUID,
    effective_at: "2026-08-01T00:00",
  }

  it("accepts an amount schedule", () => {
    const result = schema.safeParse({
      ...base,
      mode: "amount",
      target_amount: "5000000",
    })
    expect(result.success && result.data.target_amount).toBe(5_000_000)
  })

  it("accepts a percentile schedule", () => {
    const result = schema.safeParse({
      ...base,
      mode: "percentile",
      target_percentile: "5",
    })
    expect(result.success && result.data.target_percentile).toBe(5)
  })

  it("requires the amount when the mode is amount", () => {
    const result = schema.safeParse({ ...base, mode: "amount" })
    expect(issues(result)).toContainEqual({
      message: "amountRequired",
      path: "target_amount",
    })
  })

  it("requires the percentile when the mode is percentile", () => {
    const result = schema.safeParse({
      ...base,
      mode: "percentile",
      target_amount: "5000000",
    })
    expect(issues(result)).toContainEqual({
      message: "percentileRequired",
      path: "target_percentile",
    })
  })

  it("keeps the percentile strictly inside (0, 100)", () => {
    // 0 would select nobody and 100 the whole member base; neither is a tier.
    for (const bad of ["0", "100"]) {
      const result = schema.safeParse({
        ...base,
        mode: "percentile",
        target_percentile: bad,
      })
      expect(issues(result)).toContainEqual({
        message: "percentileRange",
        path: "target_percentile",
      })
    }
    for (const good of ["0.1", "99.9"]) {
      expect(
        schema.safeParse({
          ...base,
          mode: "percentile",
          target_percentile: good,
        }).success,
      ).toBe(true)
    }
  })

  // A blank amount used to coerce to 0 and satisfy the required-field refine,
  // queueing a 0đ threshold that would promote every member on the next apply.
  // Only the DOM's `required` stood between that and production.
  it("rejects a blank amount rather than queueing a 0đ threshold", () => {
    const result = schema.safeParse({
      ...base,
      mode: "amount",
      target_amount: "",
    })
    expect(issues(result)).toContainEqual({
      message: "amountRequired",
      path: "target_amount",
    })
  })

  // Same destination by a different route: an explicit 0 is not a blank, but it
  // is not a threshold either.
  it("rejects an explicit 0đ amount", () => {
    const result = schema.safeParse({
      ...base,
      mode: "amount",
      target_amount: "0",
    })
    expect(issues(result)).toContainEqual({
      message: "positive",
      path: "target_amount",
    })
  })

  it("treats a blank percentile as absent", () => {
    const result = schema.safeParse({
      ...base,
      mode: "percentile",
      target_percentile: "",
    })
    expect(issues(result)).toContainEqual({
      message: "percentileRequired",
      path: "target_percentile",
    })
  })

  // The doc comment above the schema calls the two modes mutually exclusive, but
  // only requiredness is enforced — a stray percentile beside an amount passes.
  it("does not reject a stray percentile beside an amount", () => {
    expect(
      schema.safeParse({
        ...base,
        mode: "amount",
        target_amount: "5000000",
        target_percentile: "5",
      }).success,
    ).toBe(true)
  })
})

describe("makeRewardSchema", () => {
  const schema = makeRewardSchema(v)
  const base = {
    name: "Túi cát vệ sinh",
    points_cost: "100",
    quantity: "5",
    is_exclusive: false,
    is_featured: false,
    is_active: true,
  }

  it("accepts the minimal reward", () => {
    expect(schema.safeParse(base).success).toBe(true)
  })

  it("rejects a malformed image URL", () => {
    const result = schema.safeParse({ ...base, image_url: "not-a-url" })
    expect(issues(result)).toContainEqual({
      message: "invalidUrl",
      path: "image_url",
    })
  })
})

describe("makeAdjustSchema", () => {
  const schema = makeAdjustSchema(v)
  const base = { customer_id: UUID, reason: "Bù điểm đơn lỗi" }

  it("coerces the deltas to numbers", () => {
    const result = schema.safeParse({ ...base, current_delta: "5" })
    expect(result.success && result.data.current_delta).toBe(5)
    expect(result.success && result.data.lifetime_delta).toBe(0)
  })

  it("accepts a negative delta — the RPC is what clamps the balance", () => {
    const result = schema.safeParse({ ...base, current_delta: "-5" })
    expect(result.success && result.data.current_delta).toBe(-5)
  })

  it("rejects a fractional delta", () => {
    const result = schema.safeParse({ ...base, current_delta: "5.7" })
    expect(issues(result)).toContainEqual({
      message: "wholeNumber",
      path: "current_delta",
    })
  })

  it("rejects an adjustment that changes nothing", () => {
    // Mirrors the RPC's own no-op guard so the form catches it first.
    const result = schema.safeParse({
      ...base,
      current_delta: "0",
      lifetime_delta: "0",
      grant_tier_id: "",
    })
    expect(issues(result)).toContainEqual({
      message: "adjustEmpty",
      path: "current_delta",
    })
  })

  it("accepts a tier grant with no point movement", () => {
    // A direct tier grant is a real adjustment on its own since 0012.
    expect(
      schema.safeParse({
        ...base,
        current_delta: "0",
        lifetime_delta: "0",
        grant_tier_id: UUID,
      }).success,
    ).toBe(true)
  })

  it("requires a reason", () => {
    const result = schema.safeParse({
      ...base,
      reason: "   ",
      current_delta: "5",
    })
    expect(issues(result)).toContainEqual({
      message: "reasonRequired",
      path: "reason",
    })
  })
})

describe("makeProfileSchema", () => {
  const schema = makeProfileSchema(v)

  it("accepts a filled owner half with the pet half left blank", () => {
    // Progressive profile: the pet fields may be filled in months later.
    expect(
      schema.safeParse({
        full_name: "Lê Đức Tú",
        date_of_birth: "",
        pet_name: "",
        pet_dob: "",
      }).success,
    ).toBe(true)
  })

  it("requires the owner name", () => {
    const result = schema.safeParse({ full_name: "  " })
    expect(issues(result)).toContainEqual({
      message: "nameRequired",
      path: "full_name",
    })
  })

  it("rejects a date that is not YYYY-MM-DD", () => {
    const result = schema.safeParse({
      full_name: "Lê Đức Tú",
      date_of_birth: "18/07/1995",
    })
    expect(issues(result)).toContainEqual({
      message: "invalidDate",
      path: "date_of_birth",
    })
  })
})
