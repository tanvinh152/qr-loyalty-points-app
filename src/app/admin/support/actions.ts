"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import type { SupportRequestStatus } from "@/lib/db-types"

export type SupportUpdateState = { ok: boolean; message: string }

/**
 * Flips a ticket between open and closed. No service-role client: the
 * "admin manage support requests" policy in 0007 already scopes this to
 * `is_admin()`, so a non-admin session simply updates nothing.
 */
export async function setSupportStatus(
  id: string,
  status: SupportRequestStatus,
): Promise<SupportUpdateState> {
  const t = await getMessages()
  const s = t.admin.support
  if (!id) return { ok: false, message: s.updateFailed }

  const supabase = await createClient()
  const { error, count } = await supabase
    .from("support_requests")
    .update({ status }, { count: "exact" })
    .eq("id", id)

  // RLS rejects by matching no rows rather than by erroring, so an update that
  // touched nothing is a failure too.
  if (error || count === 0) return { ok: false, message: s.updateFailed }

  revalidatePath("/admin/support")
  revalidatePath("/admin")
  return {
    ok: true,
    message: status === "closed" ? s.closed : s.reopened,
  }
}
