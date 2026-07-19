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
      // The SKU. Matches product_points.product_code.
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
    .object({ phone_number: z.string().nullish(), full_name: z.string().nullish() })
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

export type PancakeError =
  | "not_found"
  | "unauthorized"
  | "unavailable"
  | "malformed"

export class PancakeRequestError extends Error {
  constructor(readonly kind: PancakeError, message?: string) {
    super(message ?? kind)
    this.name = "PancakeRequestError"
  }
}
