"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeLoyaltySettingsSchema } from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

export async function saveSettings(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const t = await getMessages()
  const s = t.admin.settings

  const parsed = makeLoyaltySettingsSchema(t.validation).safeParse({
    rounding: formData.get("rounding"),
    unmapped_sku_points: formData.get("unmapped_sku_points"),
    claimable_statuses: formData.get("claimable_statuses"),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? s.invalidInput }
  }

  const supabase = await createClient()

  // Upsert the single active row.
  const { data: existing } = await supabase
    .from("loyalty_settings")
    .select("id")
    .eq("is_active", true)
    .maybeSingle()

  const payload = {
    ...parsed.data,
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  const { error } = existing
    ? await supabase.from("loyalty_settings").update(payload).eq("id", existing.id)
    : await supabase.from("loyalty_settings").insert(payload)

  if (error) return { ok: false, message: s.saveFailed }

  revalidatePath("/admin/settings")
  return { ok: true, message: s.saved }
}
