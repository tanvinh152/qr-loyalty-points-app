"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { pointSettingsSchema } from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

export async function saveSettings(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const parsed = pointSettingsSchema.safeParse({
    conversion_rate: formData.get("conversion_rate"),
    min_order_value: formData.get("min_order_value"),
    rounding: formData.get("rounding"),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const supabase = await createClient()

  // Upsert the single active row.
  const { data: existing } = await supabase
    .from("point_settings")
    .select("id")
    .eq("is_active", true)
    .maybeSingle()

  const payload = { ...parsed.data, is_active: true, updated_at: new Date().toISOString() }

  const { error } = existing
    ? await supabase.from("point_settings").update(payload).eq("id", existing.id)
    : await supabase.from("point_settings").insert(payload)

  if (error) return { ok: false, message: "Save failed. Check permissions." }

  revalidatePath("/admin/settings")
  return { ok: true, message: "Settings saved." }
}
