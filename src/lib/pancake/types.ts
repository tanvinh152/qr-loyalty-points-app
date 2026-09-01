import { z } from "zod"

// Narrow view of a Pancake POS order. The real payload has ~100 fields; we parse
// only what the claim flow needs and drop the rest (no .passthrough()) so nothing
// unexpected — customer PII especially — can leak into a Server Action response.
//
// Shape verified against shop 1328315613, orders 8661 / 2607180W78FJH6.

export const pancakeItemSchema = z.object({
  quantity: z.number().int().nonnegative(),
  variation_info: z
    .object({
      // The SKU. Carried into the ledger as meta.items[].sku.
      display_id: z.string().nullish(),
      name: z.string().nullish(),
      retail_price: z.number().nullish(),
      images: z.array(z.string()).nullish(),
    })
    .nullish(),
})

export const pancakeOrderSchema = z.object({
  // Marketplace/POS order code, e.g. "2607180W78FJH6".
  id: z.union([z.string(), z.number()]).transform(String),
  // Short sequential POS invoice number, e.g. 8661.
  system_id: z.number().int().nullish(),
  status: z.number().int(),
  status_name: z.string().nullish(),
  // Masked, e.g. "0****70".
  bill_phone_number: z.string().nullish(),
  shipping_address: z
    .object({
      phone_number: z.string().nullish(),
      full_name: z.string().nullish(),
    })
    .nullish(),
  customer: z
    .object({
      customer_id: z.string().nullish(),
      phone_numbers: z.array(z.string()).nullish(),
      name: z.string().nullish(),
    })
    .nullish(),
  total_price: z.number().nullish(),
  total_price_after_sub_discount: z.number().nullish(),
  // Marketplace channel, e.g. "TikTok Shop". Verified present on the list
  // endpoint (GET /shops/:id/orders); carried here on the assumption the
  // single-order GET returns the same order object — see reconcile-tiktok
  // cron for the runtime check that assumption gets on first real use.
  order_sources_name: z.string().nullish(),
  items: z.array(pancakeItemSchema).default([]),
})

export type PancakeOrder = z.infer<typeof pancakeOrderSchema>

export const pancakeResponseSchema = z.object({
  success: z.boolean().optional(),
  data: pancakeOrderSchema.nullish(),
  message: z.string().nullish(),
})

// A claim-flow view of the order: everything the UI may see, nothing else.
export type OrderLineItem = {
  sku: string | null
  name: string
  quantity: number
  points: number
}

// ---- CRM customer (GET/PUT /shops/:id/customers/:customer_id) ----
//
// Only the two fields registration writes back are parsed. Note that for
// customers created from a marketplace order the API returns `name` and
// `phone_numbers` MASKED ("K******h", "0****83") — see matchesMask in
// src/lib/phone.ts. Nothing here may be treated as a real phone number.

export const pancakeCustomerSchema = z.object({
  id: z.string().nullish(),
  customer_id: z.string().nullish(),
  name: z.string().nullish(),
  phone_numbers: z.array(z.string()).nullish(),
})

export type PancakeCustomer = z.infer<typeof pancakeCustomerSchema>

export const pancakeCustomerResponseSchema = z.object({
  success: z.boolean().optional(),
  data: pancakeCustomerSchema.nullish(),
  message: z.string().nullish(),
})

export type PancakeError =
  "not_found" | "unauthorized" | "unavailable" | "malformed"

export class PancakeRequestError extends Error {
  constructor(
    readonly kind: PancakeError,
    message?: string,
  ) {
    super(message ?? kind)
    this.name = "PancakeRequestError"
  }
}
