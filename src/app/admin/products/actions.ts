"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeProductPointSchema } from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

export async function saveProductPoint(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.products

  const id = (formData.get("id") as string) || undefined
  const parsed = makeProductPointSchema(t.validation).safeParse({
    id,
    product_code: formData.get("product_code"),
    label: formData.get("label"),
    points_awarded: formData.get("points_awarded"),
    // An unchecked checkbox sends nothing.
    is_active: formData.get("is_active") === "on",
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? m.saveFailed }
  }

  const { id: rowId, label, ...rest } = parsed.data
  const payload = { ...rest, label: label || null, updated_at: new Date().toISOString() }

  const supabase = await createClient()
  const { error } = rowId
    ? await supabase.from("product_points").update(payload).eq("id", rowId)
    : await supabase.from("product_points").insert(payload)

  if (error) return { ok: false, message: m.saveFailed }

  revalidatePath("/admin/products")
  return { ok: true, message: m.saved }
}

export async function deleteProductPoint(formData: FormData): Promise<void> {
  const id = formData.get("id") as string
  if (!id) return
  const supabase = await createClient()
  await supabase.from("product_points").delete().eq("id", id)
  revalidatePath("/admin/products")
}
