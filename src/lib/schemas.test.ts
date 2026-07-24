import { describe, expect, it } from "vitest"

import type { Messages } from "@/lib/i18n/messages"
import {
  makeAdjustSchema,
  makeLoyaltySettingsSchema,
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

describe("makeLoyaltySettingsSchema", () => {
  const schema = makeLoyaltySettingsSchema(v)
  const base = { rounding: "floor" as const, unmapped_sku_points: 0 }

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

  // BUG: a trailing comma yields a phantom status 0. `Number("")` is 0, not NaN,
  // so the every-element-is-an-integer refine sees [3, 0] and passes. Status 0 is
  // "new" in Pancake, so "3," silently makes brand-new unpaid orders claimable.
  // Pinned as-is; the fix belongs with the schema, not the test.
  it("lets a trailing comma through as status 0", () => {
    const result = schema.safeParse({ ...base, claimable_statuses: "3," })
    expect(result.success && result.data.claimable_statuses).toEqual([3, 0])
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

  // BUG: `z.union([z.coerce.number(), z.literal("")])` tries the coercion first
  // and `Number("")` is 0, so the z.literal("") branch is unreachable. A blank
  // amount field therefore parses to 0 instead of "", the required-field refine
  // sees a non-empty value, and a 0đ threshold is queued — which would promote
  // every member on the next apply. The field is only spared because the form
  // marks it required in the DOM.
  it("turns a blank amount into a 0đ threshold instead of rejecting it", () => {
    const result = schema.safeParse({
      ...base,
      mode: "amount",
      target_amount: "",
    })
    expect(result.success && result.data.target_amount).toBe(0)
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

  it("accepts a was-price above the current price", () => {
    expect(
      schema.safeParse({ ...base, original_points_cost: "150" }).success,
    ).toBe(true)
  })

  it("accepts a was-price equal to the current price", () => {
    // The DB constraint is >=, not >, so the form must not be stricter.
    expect(
      schema.safeParse({ ...base, original_points_cost: "100" }).success,
    ).toBe(true)
  })

  it("rejects a was-price below the current price", () => {
    const result = schema.safeParse({ ...base, original_points_cost: "50" })
    expect(issues(result)).toContainEqual({
      message: "originalCostTooLow",
      path: "original_points_cost",
    })
  })

  it("accepts an absent was-price", () => {
    expect(schema.safeParse(base).success).toBe(true)
  })

  // BUG: same unreachable-z.literal("") cause as the tier schedule above. A blank
  // "was" field coerces to 0, the refine then compares 0 >= points_cost and
  // fails, so an admin who clears the discount field is told the price is too
  // low. Blanking a was-price is impossible through the form today.
  it("rejects a blank was-price it should have treated as absent", () => {
    const result = schema.safeParse({ ...base, original_points_cost: "" })
    expect(issues(result)).toContainEqual({
      message: "originalCostTooLow",
      path: "original_points_cost",
    })
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
