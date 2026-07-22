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

// ---- Product catalog (GET /shops/:id/products/variations) ----
//
// Shape verified against shop 1328315613 (45 variations, one page at page_size=100).
// Same narrow-parse rule as the order: only what the admin picker renders.

export const pancakeVariationSchema = z.object({
  id: z.string(),
  // The SKU. Same value an order item carries as variation_info.display_id, and
  // what we persist as product_points.product_code.
  display_id: z.string().nullish(),
  barcode: z.string().nullish(),
  retail_price: z.number().nullish(),
  remain_quantity: z.number().nullish(),
  images: z.array(z.string()).nullish(),
  is_hidden: z.boolean().nullish(),
  is_locked: z.boolean().nullish(),
  // Variation attributes, e.g. [{name:"Cát sắn Chicha", value:"3 túi"}]. Several
  // variations share one product.name — only this tells them apart.
  fields: z
    .array(
      z.object({ name: z.string().nullish(), value: z.string().nullish() }),
    )
    .nullish(),
  product: z
    .object({ name: z.string().nullish(), is_published: z.boolean().nullish() })
    .nullish(),
})

export const pancakeVariationsResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.array(pancakeVariationSchema).default([]),
  total_pages: z.number().int().nullish(),
  page_number: z.number().int().nullish(),
})

// The catalog view handed to the browser. Everything the picker shows, nothing else.
export type CatalogVariation = {
  sku: string
  name: string
  /** Joined variation attributes, e.g. "Cát sắn Chicha: 3 túi · Xịt khử mùi: 237ml". */
  attrs: string
  image: string | null
  price: number | null
  remain: number | null
}

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
