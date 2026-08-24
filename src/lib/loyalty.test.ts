import { describe, expect, it } from "vitest"

import {
  adjustMeta,
  orderTotal,
  resolveDisplayTier,
  resolveTiers,
  tierProgress,
} from "./loyalty"
import type { MembershipTierRow } from "./db-types"

// Thresholds are LIFETIME SPEND in đồng since 0010 — never points.
const tier = (
  name: string,
  spend_threshold: number,
  sort_order: number,
): MembershipTierRow => ({
  id: `tier-${name}`,
  name,
  spend_threshold,
  multiplier: 1,
  sort_order,
  benefits: null,
  perks: [],
  created_at: "2026-01-01T00:00:00Z",
})

const SILVER = tier("silver", 0, 1)
const GOLD = tier("gold", 3_000_000, 2)
const PLATINUM = tier("platinum", 8_000_000, 3)
// Deliberately out of order: every function under test sorts for itself.
const TIERS = [PLATINUM, SILVER, GOLD]

describe("resolveTiers", () => {
  it("puts a customer in the highest tier their spend reaches", () => {
    expect(resolveTiers(TIERS, 5_000_000).current).toBe(GOLD)
    expect(resolveTiers(TIERS, 5_000_000).next).toBe(PLATINUM)
  })

  it("treats a threshold as reached at exactly that amount", () => {
    expect(resolveTiers(TIERS, 3_000_000).current).toBe(GOLD)
  })

  it("has no next tier at the top", () => {
    expect(resolveTiers(TIERS, 9_000_000).current).toBe(PLATINUM)
    expect(resolveTiers(TIERS, 9_000_000).next).toBeNull()
  })

  it("gives a zero-spend customer the entry tier", () => {
    expect(resolveTiers(TIERS, 0).current).toBe(SILVER)
  })

  it("returns no tier when nothing sits at or below the spend", () => {
    expect(resolveTiers([GOLD, PLATINUM], 100).current).toBeNull()
  })
})

describe("resolveDisplayTier", () => {
  it("keeps the stored tier when a raised threshold has left it behind", () => {
    // The grandfathering case: they hold platinum, but 4M no longer buys it.
    const customer = { tier_id: PLATINUM.id, lifetime_spend: 4_000_000 }
    expect(resolveDisplayTier(TIERS, customer)).toBe(PLATINUM)
  })

  it("uses the earned tier when it outranks the stored one", () => {
    const customer = { tier_id: SILVER.id, lifetime_spend: 9_000_000 }
    expect(resolveDisplayTier(TIERS, customer)).toBe(PLATINUM)
  })

  it("falls back to the earned tier when nothing is stored", () => {
    expect(
      resolveDisplayTier(TIERS, { tier_id: null, lifetime_spend: 3_000_000 }),
    ).toBe(GOLD)
  })

  it("keeps the stored tier when the spend earns nothing", () => {
    expect(
      resolveDisplayTier([GOLD, PLATINUM], {
        tier_id: GOLD.id,
        lifetime_spend: 0,
      }),
    ).toBe(GOLD)
  })
})

describe("tierProgress", () => {
  it("measures progress inside the band, not from zero", () => {
    // Halfway from 3M to 8M.
    const { percent, floor, toNext } = tierProgress(TIERS, 5_500_000)
    expect(floor).toBe(3_000_000)
    expect(percent).toBe(50)
    expect(toNext).toBe(2_500_000)
  })

  it("is full and has nothing left to reach at the top tier", () => {
    const { percent, next, toNext } = tierProgress(TIERS, 10_000_000)
    expect(percent).toBe(100)
    expect(next).toBeNull()
    expect(toNext).toBe(0)
  })

  it("aims a grandfathered member at the tier above the one they hold", () => {
    const customer = { tier_id: PLATINUM.id, lifetime_spend: 4_000_000 }
    const { current, next, percent } = tierProgress(TIERS, 4_000_000, customer)
    expect(current).toBe(PLATINUM)
    // Nothing above platinum, so the bar is done rather than pointing backwards.
    expect(next).toBeNull()
    expect(percent).toBe(100)
  })

  it("never reports negative progress when the floor is above the spend", () => {
    const customer = { tier_id: GOLD.id, lifetime_spend: 1_000_000 }
    const { percent } = tierProgress(TIERS, 1_000_000, customer)
    expect(percent).toBe(0)
  })
})

describe("adjustMeta", () => {
  const full = {
    reason: "Bù điểm đơn lỗi",
    actor: { id: "admin-1", email: "admin@example.com" },
    current_delta: 50,
    lifetime_delta: 50,
    granted_tier_id: "tier-Gold",
  }

  it("reads a complete ADJUST row", () => {
    expect(adjustMeta({ type: "ADJUST", meta: full })).toEqual(full)
  })

  it("ignores rows that are not adjustments", () => {
    // EARN rows carry a different meta shape entirely.
    expect(adjustMeta({ type: "EARN", meta: full })).toBeNull()
  })

  it("returns null when the row predates 0008 and has no meta", () => {
    expect(adjustMeta({ type: "ADJUST", meta: null })).toBeNull()
    expect(adjustMeta({ type: "ADJUST", meta: undefined })).toBeNull()
  })

  it("returns null for jsonb that is not an object", () => {
    expect(adjustMeta({ type: "ADJUST", meta: "reason" })).toBeNull()
    expect(adjustMeta({ type: "ADJUST", meta: 42 })).toBeNull()
  })

  it("fills defaults for every field the jsonb is missing", () => {
    expect(adjustMeta({ type: "ADJUST", meta: {} })).toEqual({
      reason: "",
      actor: null,
      current_delta: 0,
      lifetime_delta: 0,
      granted_tier_id: null,
    })
  })

  it("drops an actor with no id but keeps one whose email is missing", () => {
    expect(adjustMeta({ type: "ADJUST", meta: { actor: {} } })?.actor).toBeNull()
    expect(
      adjustMeta({ type: "ADJUST", meta: { actor: { id: "admin-1" } } })?.actor,
    ).toEqual({ id: "admin-1", email: null })
  })

  it("coerces wrongly typed fields rather than throwing", () => {
    // The column is untyped jsonb, so a hand-written row can hold anything.
    expect(
      adjustMeta({
        type: "ADJUST",
        meta: {
          reason: 7,
          current_delta: "50",
          granted_tier_id: 3,
          actor: "admin-1",
        },
      }),
    ).toEqual({
      reason: "",
      actor: null,
      current_delta: 0,
      lifetime_delta: 0,
      granted_tier_id: null,
    })
  })
})

describe("orderTotal", () => {
  it("reads the money claim_points wrote onto an EARN row", () => {
    expect(
      orderTotal({
        type: "EARN",
        meta: { items: [], multiplier: 1.1, base: 45, order_total: 450_000 },
      }),
    ).toBe(450_000)
  })

  it("accepts a numeric string, since jsonb carries no type", () => {
    expect(orderTotal({ type: "EARN", meta: { order_total: "450000" } })).toBe(
      450_000,
    )
  })

  it("returns null for an EARN row written before 0011", () => {
    // Those rows have a meta object, just no money in it.
    expect(
      orderTotal({ type: "EARN", meta: { items: [], multiplier: 1 } }),
    ).toBeNull()
  })

  it("returns null for rows that never carry an order total", () => {
    const meta = { order_total: 450_000 }
    expect(orderTotal({ type: "REDEEM", meta })).toBeNull()
    expect(orderTotal({ type: "ADJUST", meta })).toBeNull()
  })

  it("returns null when there is no meta at all", () => {
    expect(orderTotal({ type: "EARN", meta: null })).toBeNull()
    expect(orderTotal({ type: "EARN", meta: undefined })).toBeNull()
    expect(orderTotal({ type: "EARN", meta: "450000" })).toBeNull()
  })

  it("returns null rather than NaN for an unparseable value", () => {
    expect(orderTotal({ type: "EARN", meta: { order_total: "abc" } })).toBeNull()
    expect(orderTotal({ type: "EARN", meta: { order_total: "" } })).toBeNull()
    expect(orderTotal({ type: "EARN", meta: { order_total: null } })).toBeNull()
  })
})
