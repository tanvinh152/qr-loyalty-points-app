"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeRewardSchema, type RewardInput } from "@/lib/schemas"
import { deleteImageByUrl } from "@/lib/storage"

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
    min_tier_id,
    ...rest
  } = parsed.data
  const payload = {
    ...rest,
    description: description || null,
    image_url: image_url || null,
    category: category || null,
    min_tier_id: min_tier_id || null,
  }

  const supabase = await createClient()

  // Read the outgoing image before the write, so a replaced upload does not sit
  // in the bucket forever. Only ever an object of ours gets removed —
  // `deleteImageByUrl` ignores a URL that is not from the `media` bucket.
  let replaced: string | null = null
  if (rowId) {
    const { data: current } = await supabase
      .from("rewards")
      .select("image_url")
      .eq("id", rowId)
      .maybeSingle()
    if (current?.image_url && current.image_url !== payload.image_url) {
      replaced = current.image_url
    }
  }

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

  // After the row is committed, never before: a failed write must leave the old
  // image where the row still points at it. Best-effort by design — this never
  // throws, so it cannot turn a saved reward into a reported failure.
  await deleteImageByUrl(replaced)

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
  const { data: current } = await supabase
    .from("rewards")
    .select("image_url")
    .eq("id", id)
    .maybeSingle()

  const { error } = await supabase.from("rewards").delete().eq("id", id)
  if (error) return t.admin.rewards.deleteFailed

  await deleteImageByUrl(current?.image_url)

  revalidatePath("/admin/rewards")
}
