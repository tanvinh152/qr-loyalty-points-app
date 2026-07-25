"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import {
  makeTierSchema,
  makeTierScheduleSchema,
  type TierInput,
  type TierScheduleInput,
} from "@/lib/schemas"

export type SaveState = { ok: boolean; message: string } | null

/** Every screen that renders a tier or a threshold. */
function revalidateTiers() {
  revalidatePath("/admin/tiers")
  // The customer tier screen and the dashboard's tier band both read this.
  revalidatePath("/tiers")
  revalidatePath("/dashboard")
}

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
  // The five tiers are a fixed ladder: this is adjust-only, never insert. A
  // payload without an id has nothing to update, so it is refused rather than
  // silently creating a sixth tier.
  if (!rowId) return { ok: false, message: m.saveFailed }

  const payload = {
    ...rest,
    benefits: benefits || null,
    // jsonb column. An empty detail is stored as null so the tier screen can
    // render the title alone instead of an empty second line.
    perks: perks.map((perk) => ({ ...perk, detail: perk.detail || null })),
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("membership_tiers")
    .update(payload)
    .eq("id", rowId)

  if (error) return { ok: false, message: m.saveFailed }

  revalidateTiers()
  return { ok: true, message: m.saved }
}

// ---- scheduled threshold raises (0010) ----

/**
 * The same claim check the adjust action makes: these actions reach for the
 * service-role client, so they re-verify the caller rather than trusting the
 * route they sit on (src/lib/supabase/middleware.ts guards it too).
 */
async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.app_metadata?.role === "admin"
}

export async function saveTierSchedule(
  input: TierScheduleInput,
): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.tiers

  const parsed = makeTierScheduleSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? m.scheduleSaveFailed,
    }
  }
  if (!(await requireAdmin())) {
    return { ok: false, message: m.scheduleForbidden }
  }

  const { tier_id, mode, target_amount, target_percentile, effective_at, note } =
    parsed.data

  // The check constraint insists the unused column is NULL, and a
  // datetime-local value carries no zone — new Date() reads it in the server's,
  // which is where the shop's business hours are.
  const { error } = await createAdminClient()
    .from("tier_threshold_schedules")
    .insert({
      tier_id,
      mode,
      // Already numbers — the schema coerced them and its refinements guarantee
      // the field matching `mode` is present. No second Number() pass, which is
      // what used to turn a blank into 0.
      target_amount: mode === "amount" ? (target_amount ?? null) : null,
      target_percentile:
        mode === "percentile" ? (target_percentile ?? null) : null,
      effective_at: new Date(effective_at).toISOString(),
      note: note || null,
    })

  if (error) {
    // 23505 = tier_schedule_one_pending. Two queued raises for one tier would
    // apply in an order nobody chose, so the second is refused by name.
    if (error.code === "23505") {
      return { ok: false, message: m.scheduleDuplicate }
    }
    console.error("[admin] saveTierSchedule failed", tier_id, error)
    return { ok: false, message: m.scheduleSaveFailed }
  }

  revalidateTiers()
  return { ok: true, message: m.scheduleSaved }
}

export async function cancelTierSchedule(id: string): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.tiers

  if (!id) return { ok: false, message: m.scheduleCancelFailed }
  if (!(await requireAdmin())) {
    return { ok: false, message: m.scheduleForbidden }
  }

  // `applied_at is null` in the predicate, not just in the UI: an already-applied
  // schedule is the audit trail of a threshold that really moved, and deleting it
  // would erase the only record of what a percentile resolved to.
  const { error } = await createAdminClient()
    .from("tier_threshold_schedules")
    .delete()
    .eq("id", id)
    .is("applied_at", null)

  if (error) return { ok: false, message: m.scheduleCancelFailed }

  revalidateTiers()
  return { ok: true, message: m.scheduleCanceled }
}

/**
 * What "top N%" is worth in đồng right now, so the admin sees a real number
 * before committing to a rule that only resolves later. Deliberately not stored:
 * the figure that matters is the one computed on the effective date.
 */
export async function previewPercentileAmount(
  percentile: number,
): Promise<number | null> {
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile >= 100) {
    return null
  }
  if (!(await requireAdmin())) return null

  const { data, error } = await createAdminClient().rpc(
    "tier_percentile_amount",
    { p_percentile: percentile },
  )
  if (error) {
    console.error("[admin] percentile preview failed", error)
    return null
  }
  return Number(data ?? 0)
}

/**
 * Applies whatever is due, from the page render.
 *
 * The cron route is the guarantee that a raise lands on its date; this is the
 * fallback for a deployment with no cron configured, so a shop that only ever
 * opens the admin screen still gets its scheduled raises. Idempotent, so the two
 * cannot double-apply. Failures are swallowed: this must never stop the page
 * from rendering.
 */
export async function applyDueTierSchedules(): Promise<void> {
  if (!(await requireAdmin())) return
  const { error } = await createAdminClient().rpc("apply_due_tier_schedules")
  if (error) console.error("[admin] apply_due_tier_schedules failed", error)
}
