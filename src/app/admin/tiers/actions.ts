"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeTierSchema, type TierInput } from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

/**
 * The client validates with the same schema before calling, but the server is
 * the authority — an unvalidated payload must never reach the table.
 */
export async function saveTier(input: TierInput): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.tiers

  const parsed = makeTierSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? m.saveFailed,
    }
  }

  const { id: rowId, benefits, perks, ...rest } = parsed.data
  const payload = {
    ...rest,
    benefits: benefits || null,
    // jsonb column. An empty detail is stored as null so the tier screen can
    // render the title alone instead of an empty second line.
    perks: perks.map((perk) => ({ ...perk, detail: perk.detail || null })),
  }

  const supabase = await createClient()
  const { error } = rowId
    ? await supabase.from("membership_tiers").update(payload).eq("id", rowId)
    : await supabase.from("membership_tiers").insert(payload)

  if (error) return { ok: false, message: m.saveFailed }

  revalidatePath("/admin/tiers")
  // The customer tier screen and the dashboard's tier band both read this.
  revalidatePath("/tiers")
  revalidatePath("/dashboard")
  return { ok: true, message: m.saved }
}

/** Resolves to an error message, or to nothing when the row is gone. */
export async function deleteTier(id: string): Promise<string | void> {
  const t = await getMessages()
  if (!id) return t.admin.tiers.deleteFailed

  const supabase = await createClient()
  const { error } = await supabase
    .from("membership_tiers")
    .delete()
    .eq("id", id)
  if (error) return t.admin.tiers.deleteFailed

  revalidatePath("/admin/tiers")
}
