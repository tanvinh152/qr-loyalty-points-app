"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeRewardSchema, type RewardInput } from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

/** The client validates first, but the server is the authority. */
export async function saveReward(input: RewardInput): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.rewards

  const parsed = makeRewardSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? m.saveFailed,
    }
  }

  const {
    id: rowId,
    description,
    image_url,
    category,
    original_points_cost,
    ...rest
  } = parsed.data
  const payload = {
    ...rest,
    description: description || null,
    image_url: image_url || null,
    category: category || null,
    // "" means no discount. Sending 0 would render a struck-through "0 pts".
    original_points_cost:
      original_points_cost === "" || original_points_cost == null
        ? null
        : original_points_cost,
  }

  const supabase = await createClient()
  const { error } = rowId
    ? await supabase.from("rewards").update(payload).eq("id", rowId)
    : await supabase.from("rewards").insert(payload)

  if (error) {
    // `rewards_one_featured` is a partial unique index — only one active reward
    // may be featured, and hitting it is an editing mistake, not a bug.
    if (error.code === "23505") {
      return { ok: false, message: m.featuredConflict }
    }
    return { ok: false, message: m.saveFailed }
  }

  revalidatePath("/admin/rewards")
  // The shop hero, the tab bar and the dashboard tiles all read these columns.
  revalidatePath("/rewards")
  return { ok: true, message: m.saved }
}

/** Resolves to an error message, or to nothing when the row is gone. */
export async function deleteReward(id: string): Promise<string | void> {
  const t = await getMessages()
  if (!id) return t.admin.rewards.deleteFailed

  const supabase = await createClient()
  const { error } = await supabase.from("rewards").delete().eq("id", id)
  if (error) return t.admin.rewards.deleteFailed

  revalidatePath("/admin/rewards")
}
