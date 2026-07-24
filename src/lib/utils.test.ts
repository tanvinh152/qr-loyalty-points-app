import { describe, expect, it } from "vitest"

import { cn, formatVnd } from "./utils"

describe("cn", () => {
  it("keeps a type-scale size beside a text colour", () => {
    // The regression this exists for: tailwind-merge filed `text-body-sm` under
    // text-COLOR and dropped the real colour that came before it, rendering
    // `text-primary-foreground text-body-sm` as black text. The extended
    // font-size class group is what separates the two.
    const result = cn("text-primary-foreground", "text-body-sm")
    expect(result).toContain("text-primary-foreground")
    expect(result).toContain("text-body-sm")
  })

  it("still de-duplicates within the type scale", () => {
    expect(cn("text-body-sm", "text-headline-lg")).toBe("text-headline-lg")
  })

  it("still de-duplicates colours", () => {
    expect(cn("text-primary", "text-destructive")).toBe("text-destructive")
  })

  it("drops falsy inputs", () => {
    expect(cn("px-4", false, null, undefined, "py-2")).toBe("px-4 py-2")
  })
})

describe("formatVnd", () => {
  // Asserted loosely: vi-VN output uses a non-breaking space before the symbol
  // and the exact grouping character moves between ICU versions.
  it("formats đồng with no minor unit", () => {
    const result = formatVnd(1_500_000)
    expect(result).toContain("₫")
    expect(result.replace(/\D/g, "")).toBe("1500000")
  })

  it("formats zero", () => {
    expect(formatVnd(0).replace(/\D/g, "")).toBe("0")
  })
})
