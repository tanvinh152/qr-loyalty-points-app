"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"

export type SaveState = { ok: boolean; message: string } | null

// The slices themselves are gifts like any other and are managed on
// /admin/rewards (see that route's actions.ts). What is left here is the part
// that has no counterpart in the shop: settling a gift someone WON.

/**
 * Marks a won gift as handed over at the counter, or puts it back in the queue.
 * `fulfilled_by` is the staff account that pressed it — the audit trail for a
 * prize that leaves no ledger row of its own.
 */
export async function setSpinResultFulfilled(
  id: string,
  fulfilled: boolean,
): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.spin.winners
  if (!id) return { ok: false, message: m.updateFailed }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("spin_results")
    .update(
      fulfilled
        ? { fulfilled_at: new Date().toISOString(), fulfilled_by: user?.id ?? null }
        : { fulfilled_at: null, fulfilled_by: null },
    )
    .eq("id", id)

  if (error) return { ok: false, message: m.updateFailed }

  revalidatePath("/admin/spin/winners")
  revalidatePath("/spin")
  return { ok: true, message: fulfilled ? m.marked : m.unmarked }
}
