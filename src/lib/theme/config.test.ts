import { describe, expect, it } from "vitest"

import { ageFromDob, isTheme, themeForDob } from "./config"

// A fixed "today" so the age rule is deterministic.
const NOW = new Date("2026-07-24T00:00:00Z")

describe("isTheme", () => {
  it("accepts the two themes", () => {
    expect(isTheme("light")).toBe(true)
    expect(isTheme("dark")).toBe(true)
  })
  it("rejects anything else", () => {
    expect(isTheme("auto")).toBe(false)
    expect(isTheme("")).toBe(false)
    expect(isTheme(undefined)).toBe(false)
    expect(isTheme(null)).toBe(false)
  })
})

describe("ageFromDob", () => {
  it("counts whole years", () => {
    expect(ageFromDob("1990-01-01", NOW)).toBe(36)
  })
  it("does not count a birthday that has not arrived this year", () => {
    // Born 2026-12-31 vs today 2026-07-24 -> the birthday is later this year.
    expect(ageFromDob("1996-12-31", NOW)).toBe(29)
  })
  it("counts a birthday earlier in the year", () => {
    expect(ageFromDob("1996-01-01", NOW)).toBe(30)
  })
  it("returns NaN for an invalid date", () => {
    expect(Number.isNaN(ageFromDob("not-a-date", NOW))).toBe(true)
  })
})

describe("themeForDob", () => {
  it("gives light at exactly 30", () => {
    // Turns 30 on 2026-07-24 (today) -> already 30.
    expect(themeForDob("1996-07-24", NOW)).toBe("light")
  })
  it("gives dark just under 30", () => {
    expect(themeForDob("1996-07-25", NOW)).toBe("dark")
  })
  it("gives light well over 30", () => {
    expect(themeForDob("1970-05-05", NOW)).toBe("light")
  })
  it("defaults a null DOB to dark", () => {
    expect(themeForDob(null, NOW)).toBe("dark")
  })
  it("defaults an invalid DOB to dark", () => {
    expect(themeForDob("garbage", NOW)).toBe("dark")
  })
})
