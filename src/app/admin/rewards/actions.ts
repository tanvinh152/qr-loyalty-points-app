"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeRewardSchema } from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

export async function saveReward(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.rewards

  const id = (formData.get("id") as string) || undefined
  const parsed = makeRewardSchema(t.validation).safeParse({
    id,
    name: formData.get("name"),
    description: formData.get("description"),
    points_cost: formData.get("points_cost"),
    quantity: formData.get("quantity"),
    image_url: formData.get("image_url"),
    is_active: formData.get("is_active") === "on",
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? m.saveFailed }
  }

  const { id: rowId, description, image_url, ...rest } = parsed.data
  const payload = {
    ...rest,
    description: description || null,
    image_url: image_url || null,
  }

  const supabase = await createClient()
  const { error } = rowId
    ? await supabase.from("rewards").update(payload).eq("id", rowId)
    : await supabase.from("rewards").insert(payload)

  if (error) return { ok: false, message: m.saveFailed }

  revalidatePath("/admin/rewards")
  return { ok: true, message: m.saved }
}

export async function deleteReward(formData: FormData): Promise<void> {
  const id = formData.get("id") as string
  if (!id) return
  const supabase = await createClient()
  await supabase.from("rewards").delete().eq("id", id)
  revalidatePath("/admin/rewards")
}
