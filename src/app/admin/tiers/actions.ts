"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeTierSchema } from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

export async function saveTier(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.tiers

  const id = (formData.get("id") as string) || undefined
  const parsed = makeTierSchema(t.validation).safeParse({
    id,
    name: formData.get("name"),
    threshold: formData.get("threshold"),
    multiplier: formData.get("multiplier"),
    sort_order: formData.get("sort_order"),
    benefits: formData.get("benefits"),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? m.saveFailed }
  }

  const { id: rowId, benefits, ...rest } = parsed.data
  const payload = { ...rest, benefits: benefits || null }

  const supabase = await createClient()
  const { error } = rowId
    ? await supabase.from("membership_tiers").update(payload).eq("id", rowId)
    : await supabase.from("membership_tiers").insert(payload)

  if (error) return { ok: false, message: m.saveFailed }

  revalidatePath("/admin/tiers")
  return { ok: true, message: m.saved }
}

export async function deleteTier(formData: FormData): Promise<void> {
  const id = formData.get("id") as string
  if (!id) return
  const supabase = await createClient()
  await supabase.from("membership_tiers").delete().eq("id", id)
  revalidatePath("/admin/tiers")
}
