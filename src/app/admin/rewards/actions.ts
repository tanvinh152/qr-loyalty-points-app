"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import {
  makeMilestoneSchema,
  makeRewardSchema,
  makeSpinPrizeSchema,
  type MilestoneInput,
  type RewardInput,
  type SpinPrizeInput,
} from "@/lib/schemas"
import { deleteImageByUrl } from "@/lib/storage"

export type SaveState = { ok: boolean; message: string } | null

// All three kinds of gift live in `public.rewards` (0022, 0024), so every write below
// pins its `kind`: the insert stamps it and the update/delete filter on it. A
// forged id from the other tab must read as "no such row" rather than quietly
// turning a shop reward into a wheel slice.

// The RLS-scoped cookie client is the hedge here, not an explicit role check —
// `admin manage rewards` (0005) is `using (public.is_admin())`, so a stranger
// POSTing straight at these actions writes nothing. Only actions that reach for
// createAdminClient() need to re-verify the caller themselves.

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
    kind: "redeem" as const,
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
      .eq("kind", "redeem")
      .maybeSingle()
    if (current?.image_url && current.image_url !== payload.image_url) {
      replaced = current.image_url
    }
  }

  const { error } = rowId
    ? await supabase
        .from("rewards")
        .update(payload)
        .eq("id", rowId)
        .eq("kind", "redeem")
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
    .eq("kind", "redeem")
    .maybeSingle()

  const { error } = await supabase
    .from("rewards")
    .delete()
    .eq("id", id)
    .eq("kind", "redeem")
  if (error) return t.admin.rewards.deleteFailed

  await deleteImageByUrl(current?.image_url)

  revalidatePath("/admin/rewards")
  revalidatePath("/rewards")
}

/** Every revalidate a slice edit needs. The wheel is read on three routes. */
function revalidateSpin() {
  revalidatePath("/admin/rewards")
  revalidatePath("/spin")
  revalidatePath("/dashboard")
}

/** The wheel half of the same screen. Writes a `kind = 'spin'` reward row. */
export async function saveSpinPrize(input: SpinPrizeInput): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.rewards.spin

  const parsed = makeSpinPrizeSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? m.saveFailed,
    }
  }

  const {
    id: rowId,
    image_url,
    points_amount,
    weight,
    sort_order,
    quantity,
    prize_type,
    ...rest
  } = parsed.data

  const payload = {
    ...rest,
    kind: "spin" as const,
    prize_type,
    image_url: image_url || null,
    // A slice is never bought, so it must not carry a price — this is also what
    // `rewards_spin_shop_fields_check` insists on.
    points_cost: 0,
    // A gift or blank slice keeps 0 whatever the hidden points field held, so a
    // slice switched away from 'points' cannot leave a stale amount behind that
    // a later switch back would silently resurrect.
    points_amount: prize_type === "points" ? (points_amount ?? 0) : 0,
    // Only a gift is stocked; the other two are drawn without limit, and a
    // stale quantity on them would read as "sold out" in the admin grid.
    quantity: prize_type === "gift" ? (quantity ?? 0) : 0,
    // blankable() lets these arrive undefined; the column defaults would only
    // apply on insert, so both paths get an explicit number.
    weight: weight ?? 0,
    sort_order: sort_order ?? 0,
  }

  const supabase = await createClient()

  // Read the outgoing image before the write so a replaced upload does not sit
  // in the bucket forever. `deleteImageByUrl` ignores anything that is not ours.
  let replaced: string | null = null
  if (rowId) {
    const { data: current } = await supabase
      .from("rewards")
      .select("image_url")
      .eq("id", rowId)
      .eq("kind", "spin")
      .maybeSingle()
    if (current?.image_url && current.image_url !== payload.image_url) {
      replaced = current.image_url
    }
  }

  const { error } = rowId
    ? await supabase
        .from("rewards")
        .update(payload)
        .eq("id", rowId)
        .eq("kind", "spin")
    : await supabase.from("rewards").insert(payload)

  if (error) return { ok: false, message: m.saveFailed }

  // After the row is committed, never before: a failed write must leave the old
  // image where the row still points at it. Best-effort — this never throws.
  await deleteImageByUrl(replaced)

  revalidateSpin()
  return { ok: true, message: m.saved }
}

/** Resolves to an error message, or to nothing when the row is gone. */
export async function deleteSpinPrize(id: string): Promise<string | void> {
  const t = await getMessages()
  if (!id) return t.admin.rewards.spin.deleteFailed

  const supabase = await createClient()
  const { data: current } = await supabase
    .from("rewards")
    .select("image_url")
    .eq("id", id)
    .eq("kind", "spin")
    .maybeSingle()

  // spin_results.prize_id is `on delete set null` and carries its own frozen
  // copy of the name, so deleting a slice never rewrites anyone's win history.
  const { error } = await supabase
    .from("rewards")
    .delete()
    .eq("id", id)
    .eq("kind", "spin")
  if (error) return t.admin.rewards.spin.deleteFailed

  await deleteImageByUrl(current?.image_url)

  revalidateSpin()
}


/** Every revalidate a rung edit needs. The ladder is read on three routes. */
function revalidateMilestones() {
  revalidatePath("/admin/rewards")
  revalidatePath("/rewards/roadmap")
  revalidatePath("/dashboard")
}

/**
 * The spend-ladder half of the same screen. Writes a `kind = 'milestone'`
 * reward row, stamping EVERY inert column explicitly: 0024's
 * `rewards_milestone_fields_check` pins them all to zero, and relying on a
 * column default would only hold on insert, so an update could trip the check.
 */
export async function saveMilestone(input: MilestoneInput): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.rewards.milestone

  const parsed = makeMilestoneSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? m.saveFailed,
    }
  }

  const { id: rowId, image_url, description, ...rest } = parsed.data

  const payload = {
    ...rest,
    kind: "milestone" as const,
    image_url: image_url || null,
    description: description || null,
    // Never bought, never won, never stocked, never the shop's hero, never
    // tier-gated. A milestone is a published promise, so `quantity` stays 0
    // rather than becoming a way to run out of it — see 0024's header.
    points_cost: 0,
    quantity: 0,
    weight: 0,
    points_amount: 0,
    prize_type: "none" as const,
    is_featured: false,
    is_exclusive: false,
    min_tier_id: null,
  }

  const supabase = await createClient()

  // Read the outgoing image before the write so a replaced upload does not sit
  // in the bucket forever. `deleteImageByUrl` ignores anything that is not ours.
  let replaced: string | null = null
  if (rowId) {
    const { data: current } = await supabase
      .from("rewards")
      .select("image_url")
      .eq("id", rowId)
      .eq("kind", "milestone")
      .maybeSingle()
    if (current?.image_url && current.image_url !== payload.image_url) {
      replaced = current.image_url
    }
  }

  const { error } = rowId
    ? await supabase
        .from("rewards")
        .update(payload)
        .eq("id", rowId)
        .eq("kind", "milestone")
    : await supabase.from("rewards").insert(payload)

  if (error) {
    // The partial unique index from 0024: one ACTIVE rung per threshold. Read
    // back as a sentence rather than a raw 23505, the way saveReward reports
    // the featured-slot clash.
    if (error.code === "23505") {
      return { ok: false, message: m.thresholdConflict }
    }
    return { ok: false, message: m.saveFailed }
  }

  await deleteImageByUrl(replaced)

  revalidateMilestones()
  return { ok: true, message: m.saved }
}

/** Resolves to an error message, or to nothing when the row is gone. */
export async function deleteMilestone(id: string): Promise<string | void> {
  const t = await getMessages()
  if (!id) return t.admin.rewards.milestone.deleteFailed

  const supabase = await createClient()
  const { data: current } = await supabase
    .from("rewards")
    .select("image_url")
    .eq("id", id)
    .eq("kind", "milestone")
    .maybeSingle()

  // milestone_awards.milestone_id is `on delete set null` and carries its own
  // frozen name and threshold, so deleting a rung never rewrites what a member
  // already claimed. It does make the rung claimable again if recreated — the
  // unique index treats the null as distinct, which is the intended reading.
  const { error } = await supabase
    .from("rewards")
    .delete()
    .eq("id", id)
    .eq("kind", "milestone")
  if (error) return t.admin.rewards.milestone.deleteFailed

  await deleteImageByUrl(current?.image_url)

  revalidateMilestones()
}
