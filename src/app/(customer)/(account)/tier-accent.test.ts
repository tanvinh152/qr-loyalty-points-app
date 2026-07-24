import { describe, expect, it } from "vitest"

import { tierAccentClass, tierRank } from "./tier-accent"

describe("tierAccentClass", () => {
  it("gives every one of the five ranks its own gem", () => {
    const classes = [0, 1, 2, 3, 4].map(tierAccentClass)
    expect(new Set(classes).size).toBe(5)
    expect(classes[0]).toContain("--tier-1")
    expect(classes[4]).toContain("--tier-5")
  })

  it("falls back to the neutral wash when there is no tier yet", () => {
    // Keyed by rank, never by name — a renamed or translated tier must not
    // silently lose its colour.
    expect(tierAccentClass(null)).toContain("--muted-foreground")
    expect(tierAccentClass(undefined)).toContain("--muted-foreground")
    expect(tierAccentClass(-1)).toContain("--muted-foreground")
  })

  it("wraps past the fifth tier instead of going neutral", () => {
    // An admin adding a sixth tier should get a colour, not a broken-looking card.
    expect(tierAccentClass(5)).toBe(tierAccentClass(0))
    expect(tierAccentClass(6)).toBe(tierAccentClass(1))
  })

  it("truncates a fractional rank", () => {
    expect(tierAccentClass(2.9)).toBe(tierAccentClass(2))
  })
})

describe("tierRank", () => {
  const tiers = [{ id: "bronze" }, { id: "silver" }, { id: "gold" }]

  it("returns the position within the list it was handed", () => {
    expect(tierRank(tiers, "bronze")).toBe(0)
    expect(tierRank(tiers, "gold")).toBe(2)
  })

  it("returns null for a member with no tier", () => {
    expect(tierRank(tiers, null)).toBeNull()
    expect(tierRank(tiers, undefined)).toBeNull()
    expect(tierRank(tiers, "")).toBeNull()
  })

  it("returns null for a tier that is not in the list", () => {
    // A deactivated tier still sits on old customer rows.
    expect(tierRank(tiers, "platinum")).toBeNull()
  })

  it("takes the caller's ordering as authoritative", () => {
    // It does not sort. Callers must pass the threshold-sorted list, and this
    // pins that contract: the same id ranks differently in a different order.
    expect(tierRank([{ id: "gold" }, { id: "bronze" }], "gold")).toBe(0)
  })
})
