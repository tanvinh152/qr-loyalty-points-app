"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getCustomerByAuthUserId } from "@/lib/loyalty"
import { getMessages } from "@/lib/i18n/server"
import { makeProfileSchema } from "@/lib/schemas"

// Customers have no direct write path to public.customers (0005) — balances only
// ever move through SECURITY DEFINER RPCs, so the profile form goes through
// update_customer_profile (0007), which is service_role-only and can touch the
// profile columns and nothing else. The customer id comes from the session, so
// the payload cannot aim the update at another row.

export type ProfileResult = { ok: true } | { ok: false; error: string }

export async function saveProfile(input: unknown): Promise<ProfileResult> {
  const t = await getMessages()
  const parsed = makeProfileSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? t.customer.profile.failed }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: t.customer.errors.sessionExpired }

  const customer = await getCustomerByAuthUserId(user.id)
  if (!customer) return { ok: false, error: t.customer.errors.noCustomer }

  // Empty date inputs arrive as "" — Postgres wants null, not an empty string.
  const nullable = (value: string | undefined) => value?.trim() || null

  const admin = createAdminClient()
  const { error } = await admin.rpc("update_customer_profile", {
    p_customer_id: customer.id,
    p_full_name: parsed.data.full_name,
    p_dob: nullable(parsed.data.date_of_birth),
    p_pet_name: nullable(parsed.data.pet_name),
    p_pet_type: parsed.data.pet_type ?? null,
    p_pet_dob: nullable(parsed.data.pet_dob),
  })

  if (error) return { ok: false, error: t.customer.profile.failed }

  revalidatePath("/profile")
  revalidatePath("/dashboard")
  return { ok: true }
}
