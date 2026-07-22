import { z } from "zod"

import type { Messages } from "@/lib/i18n/messages"
import { MAX_PERKS, PERK_ICON_KEYS } from "@/lib/tier-perks"

// Validation messages are locale-dependent, so schemas are built per-request
// from the active catalog. Pass `t.validation` (server: getMessages(), client:
// useT()). Types are inferred from the factory return, so callers keep the same
// static types regardless of locale.
type V = Messages["validation"]

// The whole claim payload: the phone comes from the session, not the form.
// Accepts either Pancake identifier (short numeric system_id or the
// alphanumeric marketplace id).
export function makeOrderCodeSchema(v: V) {
  return z.object({
    order_code: z
      .string()
      .trim()
      .min(1, v.orderRequired)
      .max(64, v.orderRequired),
  })
}
export type OrderCodeInput = z.infer<ReturnType<typeof makeOrderCodeSchema>>

// Phone, as typed on the sign-in and sign-up forms.
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

// Customer account: login is phone + password (the phone becomes a synthetic
// email alias server-side, see phoneToEmail in src/lib/phone.ts).
export function makeCustomerLoginSchema(v: V) {
  return makePhoneSchema(v).extend({
    password: z.string().min(8, v.passwordTooShort),
  })
}
export type CustomerLoginInput = z.infer<
  ReturnType<typeof makeCustomerLoginSchema>
>

// Signup. `order_code` is only required when CUSTOMER_SIGNUP_REQUIRE_PROOF is on
// (the server re-checks it against the order's masked phone), so it stays
// optional here and the Server Action enforces it.
export function makeCustomerSignupSchema(v: V) {
  return makeCustomerLoginSchema(v).extend({
    terms: z.literal(true, { message: v.termsRequired }),
    order_code: z.string().trim().max(64).optional().or(z.literal("")),
  })
}
export type CustomerSignupInput = z.infer<
  ReturnType<typeof makeCustomerSignupSchema>
>

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
        v.invalidStatuses,
      ),
  })
}
export type LoyaltySettingsInput = z.infer<
  ReturnType<typeof makeLoyaltySettingsSchema>
>

// Admin: membership tier.
export function makeTierSchema(v: V) {
  return z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, v.tierNameRequired),
    threshold: z.coerce.number().int().min(0, v.nonNegative),
    multiplier: z.coerce.number().gt(0, v.positive),
    sort_order: z.coerce.number().int().min(0, v.nonNegative),
    benefits: z.string().trim().optional().or(z.literal("")),
    // What the customer tier screen actually renders. `benefits` above is the
    // legacy free-text field and is kept for backward compatibility.
    perks: z
      .array(
        z.object({
          icon: z.enum(PERK_ICON_KEYS),
          title: z.string().trim().min(1, v.perkTitleRequired),
          detail: z.string().trim().optional().or(z.literal("")),
        }),
      )
      .max(MAX_PERKS, v.tooManyPerks)
      .default([]),
  })
}
export type TierInput = z.infer<ReturnType<typeof makeTierSchema>>
// Pre-coercion shape — what the form fields actually hold while typing.
export type TierFormValues = z.input<ReturnType<typeof makeTierSchema>>

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
export type ProductPointInput = z.infer<
  ReturnType<typeof makeProductPointSchema>
>
export type ProductPointFormValues = z.input<
  ReturnType<typeof makeProductPointSchema>
>

// Admin: reward store item.
export function makeRewardSchema(v: V) {
  return (
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1, v.rewardNameRequired),
        description: z.string().trim().optional().or(z.literal("")),
        points_cost: z.coerce.number().int().min(0, v.nonNegative),
        // Struck-through "was" price on the shop card. Blank means no discount,
        // so it stays a string until the action maps it to null.
        original_points_cost: z
          .union([z.coerce.number().int().min(0, v.nonNegative), z.literal("")])
          .optional(),
        quantity: z.coerce.number().int().min(0, v.nonNegative),
        image_url: z
          .string()
          .trim()
          .url(v.invalidUrl)
          .optional()
          .or(z.literal("")),
        // Free-text slug: the shop's tab bar is built from the distinct values, so
        // a new category needs no migration.
        category: z.string().trim().max(40).optional().or(z.literal("")),
        is_exclusive: z.coerce.boolean(),
        is_featured: z.coerce.boolean(),
        is_active: z.coerce.boolean(),
      })
      // Mirrors the `rewards_original_cost_check` constraint, so the form reports
      // it instead of the database rejecting the write.
      .refine(
        (r) =>
          r.original_points_cost === "" ||
          r.original_points_cost == null ||
          r.original_points_cost >= r.points_cost,
        { message: v.originalCostTooLow, path: ["original_points_cost"] },
      )
  )
}
export type RewardInput = z.infer<ReturnType<typeof makeRewardSchema>>
export type RewardFormValues = z.input<ReturnType<typeof makeRewardSchema>>

// Admin: manual points/tier adjustment. Deltas are signed — the RPC is what
// refuses to push a balance below zero. `grant_tier_id` is not a tier assignment:
// the RPC turns it into a lifetime_points floor (see 0008_adjust_rpc.sql).
export function makeAdjustSchema(v: V) {
  const delta = z.coerce.number().int(v.wholeNumber).default(0)

  return z
    .object({
      customer_id: z.string().uuid(),
      current_delta: delta,
      lifetime_delta: delta,
      grant_tier_id: z.string().uuid().optional().or(z.literal("")),
      reason: z.string().trim().min(1, v.reasonRequired).max(500, v.reasonTooLong),
    })
    // Mirrors the RPC's 'no-op adjustment' guard so the form catches it first.
    .refine(
      (a) => a.current_delta !== 0 || a.lifetime_delta !== 0 || !!a.grant_tier_id,
      { message: v.adjustEmpty, path: ["current_delta"] },
    )
}
export type AdjustInput = z.infer<ReturnType<typeof makeAdjustSchema>>
export type AdjustFormValues = z.input<ReturnType<typeof makeAdjustSchema>>

// Customer: support centre contact form.
export const SUPPORT_TOPICS = [
  "points",
  "rewards",
  "account",
  "bug",
  "feature",
  "other",
] as const

export function makeSupportRequestSchema(v: V) {
  return z.object({
    name: z.string().trim().min(1, v.nameRequired),
    email: z.string().trim().email(v.invalidEmail),
    topic: z.enum(SUPPORT_TOPICS, { message: v.topicRequired }),
    message: z
      .string()
      .trim()
      .min(1, v.messageRequired)
      .max(2000, v.messageTooLong),
  })
}
export type SupportRequestInput = z.infer<
  ReturnType<typeof makeSupportRequestSchema>
>

// Customer: owner + pet profile. Every field is optional because the screen is
// a progressive profile — a customer may fill in the pet half months later.
export function makeProfileSchema(v: V) {
  const date = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, v.invalidDate)
    .optional()
    .or(z.literal(""))

  return z.object({
    full_name: z.string().trim().min(1, v.nameRequired),
    date_of_birth: date,
    pet_name: z.string().trim().optional().or(z.literal("")),
    pet_type: z.enum(["dog", "cat", "other"]).optional(),
    pet_dob: date,
  })
}
export type ProfileInput = z.infer<ReturnType<typeof makeProfileSchema>>
export type ProfileFormValues = z.input<ReturnType<typeof makeProfileSchema>>
