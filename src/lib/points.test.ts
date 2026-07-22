import { describe, it, expect } from "vitest"

import {
  calcBasePoints,
  calcOrderPoints,
  type ClaimItem,
  type LoyaltyRules,
  type SkuPointMap,
} from "./points"

const rules: LoyaltyRules = { rounding: "floor", unmapped_sku_points: 0 }
const skuMap: SkuPointMap = { SP000001: 50, STPLCHODNC500: 100 }

const items: ClaimItem[] = [
  { sku: "SP000001", quantity: 2 },
  { sku: "STPLCHODNC500", quantity: 1 },
]

describe("calcBasePoints", () => {
  it("sums quantity × per-SKU points", () => {
    expect(calcBasePoints(items, skuMap, rules)).toBe(200)
  })

  it("gives an unmapped SKU the configured fallback", () => {
    const unknown: ClaimItem[] = [{ sku: "NOPE", quantity: 3 }]
    expect(calcBasePoints(unknown, skuMap, rules)).toBe(0)
    expect(
      calcBasePoints(unknown, skuMap, { ...rules, unmapped_sku_points: 5 }),
    ).toBe(15)
  })

  it("ignores items without a SKU or with a bad quantity", () => {
    expect(
      calcBasePoints(
        [
          { sku: null, quantity: 4 },
          { sku: "SP000001", quantity: 0 },
          { sku: "SP000001", quantity: -2 },
        ],
        skuMap,
        rules,
      ),
    ).toBe(0)
  })
})

describe("calcOrderPoints", () => {
  it("applies the tier multiplier", () => {
    expect(calcOrderPoints(items, skuMap, 1.5, rules)).toBe(300)
  })

  it("floors by default rule", () => {
    // 200 × 1.2 = 240; use an odd multiplier to hit a fraction: 200 × 1.234 = 246.8
    expect(calcOrderPoints(items, skuMap, 1.234, rules)).toBe(246)
  })

  it("rounds when configured", () => {
    expect(
      calcOrderPoints(items, skuMap, 1.234, { ...rules, rounding: "round" }),
    ).toBe(247)
  })

  it("ceils when configured", () => {
    expect(
      calcOrderPoints(items, skuMap, 1.001, { ...rules, rounding: "ceil" }),
    ).toBe(201)
  })

  it("treats a missing or zero multiplier as ×1", () => {
    expect(calcOrderPoints(items, skuMap, 0, rules)).toBe(200)
  })

  it("returns 0 for an empty order", () => {
    expect(calcOrderPoints([], skuMap, 2, rules)).toBe(0)
  })
})
