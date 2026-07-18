import { z } from "zod"

// Step 1: order code lookup.
export const orderCodeSchema = z.object({
  order_code: z.string().trim().min(1, "Order code is required"),
})
export type OrderCodeInput = z.infer<typeof orderCodeSchema>

// Step 2/3: customer info for the claim.
export const customerInfoSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .min(6, "Phone is required")
    .regex(/^[0-9+\-\s()]+$/, "Invalid phone number"),
})
export type CustomerInfoInput = z.infer<typeof customerInfoSchema>

// Full claim payload (server re-validates).
export const claimSchema = orderCodeSchema.merge(customerInfoSchema)
export type ClaimInput = z.infer<typeof claimSchema>

// Admin: point settings form.
export const pointSettingsSchema = z.object({
  conversion_rate: z.coerce.number().min(0, "Must be >= 0"),
  min_order_value: z.coerce.number().min(0, "Must be >= 0"),
  rounding: z.enum(["floor", "round", "ceil"]),
})
export type PointSettingsInput = z.infer<typeof pointSettingsSchema>

// Webhook: incoming third-party order payload.
export const webhookOrderSchema = z.object({
  external_order_id: z.string().min(1),
  order_code: z.string().min(1),
  total: z.number().nonnegative(),
})
export type WebhookOrderInput = z.infer<typeof webhookOrderSchema>
