import "server-only"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getCustomerByAuthUserId, linkAuthUserToPhone } from "@/lib/loyalty"
import { normalizePhone } from "@/lib/phone"
import type { CustomerRow } from "@/lib/db-types"

/**
 * Session + points account for every page under (account).
 *
 * Middleware already guarantees a session here, so the redirect is only a
 * belt-and-braces for direct RSC calls. The customer row can legitimately be
 * missing if signup died between `auth.signUp` and the link step — in that case
 * we re-run the link from the phone stored on the auth user rather than stranding
 * the account. Callers must still handle `customer: null` (someone else already
 * owns that phone), and the layout renders the notice for it.
 */
export async function getAccount(): Promise<{
  email: string | null
  customer: CustomerRow | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let customer = await getCustomerByAuthUserId(user.id)

  if (!customer) {
    const phone = normalizePhone(String(user.user_metadata?.phone ?? ""))
    if (phone) {
      const linked = await linkAuthUserToPhone(user.id, phone)
      if (linked.ok) customer = linked.customer
    }
  }

  return { email: user.email ?? null, customer }
}
