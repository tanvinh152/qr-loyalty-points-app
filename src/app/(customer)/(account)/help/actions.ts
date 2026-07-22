"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getCustomerByAuthUserId } from "@/lib/loyalty"
import { getMessages } from "@/lib/i18n/server"
import { makeSupportRequestSchema } from "@/lib/schemas"

// The insert runs with the service-role client and a customer_id resolved from
// the session, not from the payload — support_requests has no customer INSERT
// policy on purpose, so the browser can never file a ticket against someone
// else's account.

export type SupportResult = { ok: true } | { ok: false; error: string }

export async function submitSupportRequest(
  input: unknown,
): Promise<SupportResult> {
  const t = await getMessages()
  const parsed = makeSupportRequestSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: t.customer.errors.supportFailed }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: t.customer.errors.sessionExpired }

  const customer = await getCustomerByAuthUserId(user.id)
  if (!customer) return { ok: false, error: t.customer.errors.noCustomer }

  const admin = createAdminClient()
  const { error } = await admin.from("support_requests").insert({
    customer_id: customer.id,
    name: parsed.data.name,
    email: parsed.data.email,
    topic: parsed.data.topic,
    message: parsed.data.message,
  })

  if (error) return { ok: false, error: t.customer.errors.supportFailed }
  return { ok: true }
}
