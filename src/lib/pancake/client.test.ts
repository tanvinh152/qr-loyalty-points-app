import { describe, expect, it } from "vitest"

import {
  canonicalOrderCode,
  orderPhoneCandidates,
  orderSpendTotal,
  toClaimItems,
  toRpcItems,
} from "./client"
import type { PancakeOrder } from "./types"

// The real payload has ~100 fields; the parsed view has ten. Only what a given
// assertion cares about is spelled out at the call site.
function order(partial: Partial<PancakeOrder> = {}): PancakeOrder {
  return {
    id: "2607180W78FJH6",
    system_id: 8661,
    status: 3,
    status_name: "delivered",
    bill_phone_number: null,
    shipping_address: null,
    customer: null,
    total_price: null,
    total_price_after_sub_discount: null,
    items: [],
    ...partial,
  }
}

function item(quantity: number, sku?: string | null) {
  return {
    quantity,
    variation_info: sku === undefined ? null : { display_id: sku },
  }
}

describe("canonicalOrderCode", () => {
  it("returns the marketplace id, not the short invoice number", () => {
    // `id` is what gets persisted as order_code; system_id is only an input the
    // lookup accepts. Returning the wrong one would let the same order be
    // claimed twice under two different codes.
    expect(canonicalOrderCode(order({ id: "ABC123", system_id: 8661 }))).toBe(
      "ABC123",
    )
  })
})

describe("orderSpendTotal", () => {
  it("prefers the discounted total", () => {
    expect(
      orderSpendTotal(
        order({ total_price: 500_000, total_price_after_sub_discount: 420_000 }),
      ),
    ).toBe(420_000)
  })

  it("falls back to total_price only when the discounted total is absent", () => {
    expect(
      orderSpendTotal(
        order({ total_price: 500_000, total_price_after_sub_discount: null }),
      ),
    ).toBe(500_000)
    expect(
      orderSpendTotal(
        order({
          total_price: 500_000,
          total_price_after_sub_discount: undefined,
        }),
      ),
    ).toBe(500_000)
  })

  it("treats a fully discounted order as zero spend, not as a missing total", () => {
    // `??` only falls through on null/undefined, so an explicit 0 short-circuits
    // and the pre-discount figure is never consulted. A 100%-off order must not
    // push anyone up the tier ladder.
    expect(
      orderSpendTotal(
        order({ total_price: 500_000, total_price_after_sub_discount: 0 }),
      ),
    ).toBe(0)
  })

  it("collapses missing, negative and non-finite totals to zero", () => {
    expect(orderSpendTotal(order())).toBe(0)
    expect(orderSpendTotal(order({ total_price: -1 }))).toBe(0)
    expect(orderSpendTotal(order({ total_price: Number.NaN }))).toBe(0)
    expect(
      orderSpendTotal(order({ total_price: Number.POSITIVE_INFINITY })),
    ).toBe(0)
  })
})

describe("orderPhoneCandidates", () => {
  it("returns every number, billing first, and does not stop at the first hit", () => {
    // The regression this guards: settling for bill_phone_number (always masked)
    // while the real number sat in customer.phone_numbers two fields away.
    expect(
      orderPhoneCandidates(
        order({
          bill_phone_number: "0****70",
          customer: { phone_numbers: ["0912345670", "0987654321"] },
          shipping_address: { phone_number: "0***321" },
        }),
      ),
    ).toEqual(["0****70", "0912345670", "0987654321", "0***321"])
  })

  it("drops null, undefined, empty and whitespace-only entries", () => {
    expect(
      orderPhoneCandidates(
        order({
          bill_phone_number: null,
          customer: { phone_numbers: ["", "   ", "0912345670"] },
          shipping_address: { phone_number: undefined },
        }),
      ),
    ).toEqual(["0912345670"])
  })

  it("returns nothing when the order carries no phone at all", () => {
    expect(orderPhoneCandidates(order())).toEqual([])
  })
})

describe("toClaimItems", () => {
  it("lifts the SKU out of variation_info", () => {
    expect(toClaimItems(order({ items: [item(2, "CAT-LITTER-5KG")] }))).toEqual([
      { sku: "CAT-LITTER-5KG", quantity: 2 },
    ])
  })

  it("yields a null SKU when variation_info or display_id is missing", () => {
    // Points no longer come from the SKU (0025), but the line is still the
    // ledger's per-item audit trail in meta.items, so it must survive as a row
    // rather than being filtered out here.
    expect(toClaimItems(order({ items: [item(1), item(3, null)] }))).toEqual([
      { sku: null, quantity: 1 },
      { sku: null, quantity: 3 },
    ])
  })

  it("keeps every line, including duplicates of the same SKU", () => {
    expect(
      toClaimItems(order({ items: [item(1, "A"), item(2, "A")] })),
    ).toHaveLength(2)
  })
})

describe("toRpcItems", () => {
  it("renames quantity to qty and preserves order", () => {
    // jsonb_to_recordset in claim_points reads `qty`; a stray `quantity` key
    // silently becomes NULL and the line earns nothing.
    expect(
      toRpcItems(order({ items: [item(2, "A"), item(1, null)] })),
    ).toEqual([
      { sku: "A", qty: 2 },
      { sku: null, qty: 1 },
    ])
  })
})
