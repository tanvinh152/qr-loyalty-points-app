import { describe, expect, it } from "vitest"

import { matchesMask, normalizePhone } from "./phone"

describe("normalizePhone", () => {
  it("keeps a local number as-is", () => {
    expect(normalizePhone("0901234594")).toBe("0901234594")
  })
  it("converts +84 and 84 prefixes", () => {
    expect(normalizePhone("+84901234594")).toBe("0901234594")
    expect(normalizePhone("84901234594")).toBe("0901234594")
  })
  it("strips separators", () => {
    expect(normalizePhone("090 123 45 94")).toBe("0901234594")
    expect(normalizePhone("090-123-4594")).toBe("0901234594")
  })
})

describe("matchesMask", () => {
  const mask = "0****94" // real Pancake shape: first 1 + last 2 digits

  it("accepts a matching phone", () => {
    expect(matchesMask("0901234594", mask)).toBe(true)
  })
  it("accepts the +84 form of a matching phone", () => {
    expect(matchesMask("+84901234594", mask)).toBe(true)
  })
  it("rejects a wrong suffix", () => {
    expect(matchesMask("0901234570", mask)).toBe(false)
  })
  it("rejects a wrong prefix", () => {
    expect(matchesMask("1901234594", mask)).toBe(false)
  })
  it("fails closed on missing or useless masks", () => {
    expect(matchesMask("0901234594", null)).toBe(false)
    expect(matchesMask("0901234594", "")).toBe(false)
    expect(matchesMask("0901234594", "*******")).toBe(false)
  })
  it("rejects an input shorter than the visible parts", () => {
    expect(matchesMask("094", mask)).toBe(false)
  })
  it("compares exactly when the mask is unmasked", () => {
    expect(matchesMask("0901234594", "0901234594")).toBe(true)
    expect(matchesMask("0901234595", "0901234594")).toBe(false)
  })
})
