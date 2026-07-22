"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeProductPointSchema, type ProductPointInput } from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

/** The client validates first, but the server is the authority. */
export async function saveProductPoint(
  input: ProductPointInput,
): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.products

  const parsed = makeProductPointSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? m.saveFailed,
    }
  }

  const { id: rowId, label, ...rest } = parsed.data
  const payload = {
    ...rest,
    label: label || null,
    updated_at: new Date().toISOString(),
  }

  const supabase = await createClient()
  const { error } = rowId
    ? await supabase.from("product_points").update(payload).eq("id", rowId)
    : await supabase.from("product_points").insert(payload)

  // product_code is unique — 23505 means the SKU already has a mapping.
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? m.duplicate : m.saveFailed,
    }
  }

  revalidatePath("/admin/products")
  return { ok: true, message: m.saved }
}

/** Resolves to an error message, or to nothing when the row is gone. */
export async function deleteProductPoint(id: string): Promise<string | void> {
  const t = await getMessages()
  if (!id) return t.admin.products.deleteFailed

  const supabase = await createClient()
  const { error } = await supabase.from("product_points").delete().eq("id", id)
  if (error) return t.admin.products.deleteFailed

  revalidatePath("/admin/products")
}
