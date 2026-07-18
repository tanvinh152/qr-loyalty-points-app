import { describe, it, expect } from "vitest"

import { calcPoints, type PointSettings } from "./points"

const base: PointSettings = {
  conversion_rate: 0.1,
  min_order_value: 50000,
  rounding: "floor",
}

describe("calcPoints", () => {
  it("returns 0 below the minimum order value", () => {
    expect(calcPoints(45000, base)).toBe(0)
  })

  it("awards points at the minimum threshold", () => {
    expect(calcPoints(50000, base)).toBe(5000)
  })

  it("floors by default rule", () => {
    expect(calcPoints(99999, base)).toBe(9999) // 9999.9 -> floor
  })

  it("rounds when configured", () => {
    expect(calcPoints(99999, { ...base, rounding: "round" })).toBe(10000)
  })

  it("ceils when configured", () => {
    expect(calcPoints(99991, { ...base, rounding: "ceil" })).toBe(10000) // 9999.1 -> 10000
  })

  it("handles zero conversion rate", () => {
    expect(calcPoints(100000, { ...base, conversion_rate: 0 })).toBe(0)
  })
})
