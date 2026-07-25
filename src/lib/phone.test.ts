import { describe, expect, it } from "vitest"

import {
  isMasked,
  isValidVnPhone,
  matchesMask,
  matchesOrderPhones,
  normalizePhone,
} from "./phone"

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

// The normalized phone is the account key — it becomes the email alias and the
// unique column in `customers`. Everything that normalizes to the same string
// must be accepted, and everything that does not must be refused, or one person
// ends up with several accounts and their points split across them.
describe("isValidVnPhone", () => {
  it("accepts every spelling that normalizes to the same number", () => {
    for (const spelling of [
      "0901234567",
      "+84901234567",
      "84901234567",
      "090 123 4567",
      "090-123-4567",
    ]) {
      expect(isValidVnPhone(spelling), spelling).toBe(true)
    }
  })

  it("accepts each live mobile prefix", () => {
    for (const prefix of ["03", "05", "07", "08", "09"]) {
      expect(isValidVnPhone(`${prefix}01234567`), prefix).toBe(true)
    }
  })

  it("refuses a number missing its leading zero", () => {
    // This is the duplicate-account case: "901234567" would otherwise become a
    // second alias for the holder of "0901234567".
    expect(isValidVnPhone("901234567")).toBe(false)
  })

  it("refuses landline and other non-mobile prefixes", () => {
    expect(isValidVnPhone("0201234567")).toBe(false)
    expect(isValidVnPhone("0401234567")).toBe(false)
    expect(isValidVnPhone("0601234567")).toBe(false)
  })

  it("refuses the wrong length", () => {
    expect(isValidVnPhone("090123456")).toBe(false)
    expect(isValidVnPhone("09012345678")).toBe(false)
  })

  it("refuses separator-only and empty input", () => {
    expect(isValidVnPhone("")).toBe(false)
    expect(isValidVnPhone("() - ")).toBe(false)
  })
})

describe("isMasked", () => {
  it("spots the shapes Pancake actually returns", () => {
    expect(isMasked("0****52")).toBe(true)
    expect(isMasked("L******h")).toBe(true)
    expect(isMasked("+84978****30")).toBe(true)
  })
  it("passes real values through", () => {
    expect(isMasked("0376733152")).toBe(false)
    expect(isMasked("Lê tấn Vinh")).toBe(false)
  })
  it("treats absent or blank values as masked", () => {
    expect(isMasked(null)).toBe(true)
    expect(isMasked(undefined)).toBe(true)
    expect(isMasked("   ")).toBe(true)
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

describe("matchesOrderPhones", () => {
  // Shape of a real order: Pancake keeps the mask next to the number it knows.
  const known = ["0****52", "0376733152"]
  const maskedOnly = ["0****52"]

  it("accepts the real number when the order carries one", () => {
    expect(matchesOrderPhones("0376733152", known)).toBe(true)
    expect(matchesOrderPhones("+84376733152", known)).toBe(true)
  })
  it("stops a mask-compatible impostor once the real number is known", () => {
    // Passes matchesMask against "0****52" — that is exactly the hole.
    expect(matchesOrderPhones("0999999952", known)).toBe(false)
    expect(matchesOrderPhones("0999999952", maskedOnly)).toBe(true)
  })
  it("falls back to the mask when nothing better exists", () => {
    expect(matchesOrderPhones("0376733152", maskedOnly)).toBe(true)
    expect(matchesOrderPhones("0376733199", maskedOnly)).toBe(false)
  })
  it("checks every candidate, not just the first", () => {
    expect(matchesOrderPhones("0376733152", ["0376733152", "0912000000"])).toBe(
      true,
    )
    expect(matchesOrderPhones("0912000000", ["0376733152", "0912000000"])).toBe(
      true,
    )
  })
  it("fails closed on an empty or blank list", () => {
    expect(matchesOrderPhones("0376733152", [])).toBe(false)
    expect(matchesOrderPhones("0376733152", [null, undefined, "  "])).toBe(false)
    expect(matchesOrderPhones("", known)).toBe(false)
  })
})
