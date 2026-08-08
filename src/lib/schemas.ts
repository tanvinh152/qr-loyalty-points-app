import { z } from "zod"

import type { Messages } from "@/lib/i18n/messages"
import { PANCAKE_ORDER_STATUSES } from "@/lib/pancake/order-status"
import { normalizePhone, VN_MOBILE_RE } from "@/lib/phone"
import { MAX_PERKS, PERK_ICON_KEYS } from "@/lib/tier-perks"

// Validation messages are locale-dependent, so schemas are built per-request
// from the active catalog. Pass `t.validation` (server: getMessages(), client:
// useT()). Types are inferred from the factory return, so callers keep the same
// static types regardless of locale.
type V = Messages["validation"]

// An empty number input posts "" — not undefined. `z.coerce.number()` turns
// that into 0, and since a union tries its branches in order, pairing it with
// `z.literal("")` never reaches the literal: the blank simply becomes a valid
// zero. That is how a cleared "amount" field once queued a 0đ tier threshold.
// Strip the blank BEFORE any coercion so "absent" stays absent and the
// required-field refinements below actually see it.
function blankable<T extends z.ZodType>(inner: T) {
  return z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    inner.optional(),
  )
}

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
//
// Output is the NORMALIZED number, not what was typed: "+84 90 123 4567",
// "8490 123 4567" and "0901234567" all parse to "0901234567". Callers may still
// run normalizePhone on the result — it is idempotent — but they no longer have
// to, and three spellings can no longer become three accounts.
export function makePhoneSchema(v: V) {
  return z.object({
    phone: z
      .string()
      .trim()
      .min(1, v.phoneRequired)
      .transform(normalizePhone)
      .refine((p) => VN_MOBILE_RE.test(p), v.invalidPhone),
  })
}
export type PhoneInput = z.infer<ReturnType<typeof makePhoneSchema>>

// Customer account: login is phone + password. Supabase's password provider is
// email-keyed, so the server looks the member's real address up by phone
// (customers.email) before signing in — the phone is the lookup key, never the
// credential Supabase sees.
export function makeCustomerLoginSchema(v: V) {
  return makePhoneSchema(v).extend({
    password: z.string().min(8, v.passwordTooShort),
  })
}
export type CustomerLoginInput = z.infer<
  ReturnType<typeof makeCustomerLoginSchema>
>

// Signup. Every field is mandatory: the order code proves the phone is the
// member's (the server re-checks it against the order's masked phone) AND is the
// only source of the Pancake customer id the webhook later needs, and the
// name/DOB are pushed onto the POS record so staff see a real customer.
//
// The email is the account's auth identity AND the only address support can
// reach a member at, so it is collected here and nowhere else. Lower-cased so
// the address on auth.users, the one in customers.email and the unique index
// over it can never disagree about the same mailbox.
export function makeCustomerSignupSchema(v: V) {
  return makeCustomerLoginSchema(v).extend({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, v.emailRequired)
      .email(v.invalidEmail),
    full_name: z.string().trim().min(1, v.nameRequired),
    date_of_birth: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, v.invalidDate),
    terms: z.literal(true, { message: v.termsRequired }),
    order_code: z.string().trim().min(1, v.orderRequired).max(64),
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
    // One-time points granted on registration. 0 = feature off.
    welcome_gift_points: z.coerce.number().int().min(0, v.nonNegative),
    // Points for one daily check-in. 0 = feature off.
    checkin_points: z.coerce.number().int().min(0, v.nonNegative),
    // Free text in the form ("3, 16") -> int[].
    //
    // Empty segments are dropped, not parsed: `Number("")` is 0 and 0 is
    // Pancake's "new", so a stray trailing comma used to make brand-new unpaid
    // orders claimable. Values are then checked against the real status list —
    // a typo'd 999 is a silent no-op, not a setting.
    claimable_statuses: z
      .string()
      .trim()
      .min(1, v.invalidStatuses)
      .transform((s) =>
        s
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .map(Number),
      )
      .refine(
        (arr) =>
          arr.length > 0 &&
          arr.every((n) =>
            (PANCAKE_ORDER_STATUSES as readonly number[]).includes(n),
          ),
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
    // Đồng, not points (0010). Whole units: Vietnamese currency has no minor unit.
    spend_threshold: z.coerce.number().int().min(0, v.nonNegative),
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

// Admin: a queued raise of one tier's spend threshold.
//
// The two modes are mutually exclusive and each requires its own field, which
// is why this cannot be a flat object with two optional numbers — a percentile
// with a stray amount beside it would be ambiguous at apply time.
export function makeTierScheduleSchema(v: V) {
  return z
    .object({
      id: z.string().uuid().optional(),
      tier_id: z.string().uuid(v.tierRequired),
      mode: z.enum(["amount", "percentile"]),
      // Strictly positive, matching the CHECK on tier_threshold_schedules:
      // a 0đ threshold is not a tier, it is every member at once.
      target_amount: blankable(z.coerce.number().int().gt(0, v.positive)),
      // "Top N%" — strictly inside (0, 100): 0 would select nobody and 100 the
      // whole base, neither of which is a tier.
      target_percentile: blankable(
        z.coerce.number().gt(0, v.percentileRange).lt(100, v.percentileRange),
      ),
      // datetime-local gives "YYYY-MM-DDTHH:mm"; the action turns it into an ISO
      // instant in the server's zone.
      effective_at: z.string().trim().min(1, v.effectiveAtRequired),
      note: z.string().trim().max(200).optional().or(z.literal("")),
    })
    .refine((s) => s.mode !== "amount" || s.target_amount != null, {
      message: v.amountRequired,
      path: ["target_amount"],
    })
    .refine((s) => s.mode !== "percentile" || s.target_percentile != null, {
      message: v.percentileRequired,
      path: ["target_percentile"],
    })
}
export type TierScheduleInput = z.infer<ReturnType<typeof makeTierScheduleSchema>>
export type TierScheduleFormValues = z.input<
  ReturnType<typeof makeTierScheduleSchema>
>

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
  return z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, v.rewardNameRequired),
    description: z.string().trim().optional().or(z.literal("")),
    points_cost: z.coerce.number().int().min(0, v.nonNegative),
    quantity: z.coerce.number().int().min(0, v.nonNegative),
    image_url: z.string().trim().url(v.invalidUrl).optional().or(z.literal("")),
    // Free-text slug: the shop's tab bar is built from the distinct values, so
    // a new category needs no migration.
    category: z.string().trim().max(40).optional().or(z.literal("")),
    is_exclusive: z.coerce.boolean(),
    is_featured: z.coerce.boolean(),
    is_active: z.coerce.boolean(),
    // Minimum tier required to redeem. Blank = unrestricted, same as null.
    min_tier_id: z.string().uuid().optional().or(z.literal("")),
  })
}
export type RewardInput = z.infer<ReturnType<typeof makeRewardSchema>>
export type RewardFormValues = z.input<ReturnType<typeof makeRewardSchema>>

// Admin: manual points/tier adjustment. Deltas are signed — the RPC is what
// refuses to push a balance below zero. `grant_tier_id` IS a direct tier
// assignment since 0012; it never invents spend or lifetime points.
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

// Admin: blog & promotion post.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function makeBlogPostSchema(v: V) {
  return z.object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, v.blogTitleRequired),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, v.blogSlugRequired)
      .regex(SLUG_RE, v.invalidSlug),
    excerpt: z.string().trim().max(300).optional().or(z.literal("")),
    content: z.string().trim().min(1, v.blogContentRequired),
    cover_image_url: z
      .string()
      .trim()
      .url(v.invalidUrl)
      .optional()
      .or(z.literal("")),
    post_type: z.enum(["article", "promotion"]),
    is_published: z.coerce.boolean(),
  })
}
export type BlogPostInput = z.infer<ReturnType<typeof makeBlogPostSchema>>
export type BlogPostFormValues = z.input<ReturnType<typeof makeBlogPostSchema>>

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
