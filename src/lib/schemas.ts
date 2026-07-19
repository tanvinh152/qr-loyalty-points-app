import { z } from "zod"

import type { Messages } from "@/lib/i18n/messages"

// Validation messages are locale-dependent, so schemas are built per-request
// from the active catalog. Pass `t.validation` (server: getMessages(), client:
// useT()). Types are inferred from the factory return, so callers keep the same
// static types regardless of locale.
type V = Messages["validation"]

// Step 1: order code lookup. Accepts either Pancake identifier (short numeric
// system_id or the alphanumeric marketplace id).
export function makeOrderCodeSchema(v: V) {
  return z.object({
    order_code: z.string().trim().min(1, v.orderRequired).max(64, v.orderRequired),
  })
}
export type OrderCodeInput = z.infer<ReturnType<typeof makeOrderCodeSchema>>

// Step 2: phone ownership check.
export function makePhoneSchema(v: V) {
  return z.object({
    phone: z
      .string()
      .trim()
      .min(6, v.phoneRequired)
      .regex(/^[0-9+\-\s()]+$/, v.invalidPhone),
  })
}
export type PhoneInput = z.infer<ReturnType<typeof makePhoneSchema>>

// Step 3: contact details attached to the claim.
export function makeCustomerInfoSchema(v: V) {
  return z.object({
    full_name: z.string().trim().min(1, v.nameRequired),
    email: z.string().trim().email(v.invalidEmail).optional().or(z.literal("")),
  })
}
export type CustomerInfoInput = z.infer<ReturnType<typeof makeCustomerInfoSchema>>

// Full claim payload (the server re-validates and re-fetches the order).
export function makeClaimSchema(v: V) {
  return makeOrderCodeSchema(v)
    .merge(makePhoneSchema(v))
    .merge(makeCustomerInfoSchema(v))
}
export type ClaimInput = z.infer<ReturnType<typeof makeClaimSchema>>

// Admin: global loyalty rules.
export function makeLoyaltySettingsSchema(v: V) {
  return z.object({
    rounding: z.enum(["floor", "round", "ceil"]),
    unmapped_sku_points: z.coerce.number().int().min(0, v.nonNegative),
    // Free text in the form ("3, 16") -> int[].
    claimable_statuses: z
      .string()
      .trim()
      .min(1, v.invalidStatuses)
      .transform((s) => s.split(",").map((part) => Number(part.trim())))
      .refine(
        (arr) => arr.length > 0 && arr.every((n) => Number.isInteger(n)),
        v.invalidStatuses
      ),
  })
}
export type LoyaltySettingsInput = z.infer<ReturnType<typeof makeLoyaltySettingsSchema>>

// Admin: membership tier.
export function makeTierSchema(v: V) {
  return z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, v.tierNameRequired),
    threshold: z.coerce.number().int().min(0, v.nonNegative),
    multiplier: z.coerce.number().gt(0, v.positive),
    sort_order: z.coerce.number().int().min(0, v.nonNegative),
    benefits: z.string().trim().optional().or(z.literal("")),
  })
}
export type TierInput = z.infer<ReturnType<typeof makeTierSchema>>

// Admin: SKU -> points mapping.
export function makeProductPointSchema(v: V) {
  return z.object({
    id: z.string().uuid().optional(),
    product_code: z.string().trim().min(1, v.skuRequired),
    label: z.string().trim().optional().or(z.literal("")),
    points_awarded: z.coerce.number().int().min(0, v.nonNegative),
    is_active: z.coerce.boolean(),
  })
}
export type ProductPointInput = z.infer<ReturnType<typeof makeProductPointSchema>>

// Admin: reward store item.
export function makeRewardSchema(v: V) {
  return z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, v.rewardNameRequired),
    description: z.string().trim().optional().or(z.literal("")),
    points_cost: z.coerce.number().int().min(0, v.nonNegative),
    quantity: z.coerce.number().int().min(0, v.nonNegative),
    image_url: z.string().trim().url(v.invalidUrl).optional().or(z.literal("")),
    is_active: z.coerce.boolean(),
  })
}
export type RewardInput = z.infer<ReturnType<typeof makeRewardSchema>>
