import { createAdminClient } from "@/lib/supabase/admin"
import { getOrder, orderSpendTotal } from "@/lib/pancake/client"
import { PancakeRequestError } from "@/lib/pancake/types"
import type {
  ApplyScheduleResult,
  PendingOrderReconciliationRow,
  ReconcileOrderSpendResult,
} from "@/lib/db-types"

// The scheduled work, one exported function per job.
//
// Split out of the route so the orchestrator in ./route.ts can run them in
// sequence and isolate a failure to one job. Each returns a plain summary and
// THROWS on failure — turning that into an HTTP status is the route's business,
// not the job's, and a job that swallowed its own error could never be reported
// as failed in the run summary.

/** Job names the orchestrator knows. Order here is the order they run in. */
export const JOB_NAMES = ["tier-schedules", "reconcile-tiktok"] as const
export type JobName = (typeof JOB_NAMES)[number]

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value)
}

// ---- tier-schedules ----
//
// Applies any tier threshold raise whose effective date has arrived.
//
// The RPC is idempotent (`applied_at is null` + `for update skip locked`), so
// running this more often than needed is harmless — and it is also called
// fire-and-forget when an admin opens /admin/tiers, which is what makes the
// feature work on a deployment with no cron configured at all. The cron is the
// guarantee that a raise lands on its date even if nobody visits.
export async function runTierSchedules() {
  const { data, error } = await createAdminClient().rpc(
    "apply_due_tier_schedules",
  )
  if (error) {
    console.error("[tier-schedules] apply failed", error)
    throw new Error("apply_failed")
  }

  const applied = (data as ApplyScheduleResult)?.applied ?? []
  // Logged individually: a threshold move is the kind of thing someone will want
  // to reconstruct months later from the logs alone.
  for (const row of applied) {
    console.info(
      `[tier-schedules] ${row.tier_name ?? row.tier_id}: ${row.from} -> ${row.to}`,
    )
  }
  return { applied }
}

// ---- reconcile-tiktok ----
//
// Re-fetches every TikTok order the Pancake webhook queued (0016) once its
// reconcile_after has passed, and corrects lifetime_spend if Pancake's synced
// total moved since the order was claimed. See pending_order_reconciliations
// and reconcile_order_spend in 0016_tiktok_reconciliation.sql for why this
// touches spend, not points.
export async function runTikTokReconciliation() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("pending_order_reconciliations")
    .select("*")
    .eq("status", "pending")
    .lte("reconcile_after", new Date().toISOString())

  if (error) {
    console.error("[reconcile-tiktok] fetch due rows failed", error)
    throw new Error("fetch_failed")
  }

  const due = (data ?? []) as PendingOrderReconciliationRow[]
  const results = { reconciled: 0, unchanged: 0, failed: 0, skipped: 0 }

  // Pancake has no batch order lookup, so this is inherently one request per
  // order — sequential on purpose to stay under its rate limit.
  for (const row of due) {
    const outcome = await reconcileOne(row)
    results[outcome]++
  }

  return { due: due.length, ...results }
}

async function reconcileOne(
  row: PendingOrderReconciliationRow,
): Promise<"reconciled" | "unchanged" | "failed" | "skipped"> {
  const supabase = createAdminClient()

  let currentTotal: number
  try {
    const order = await getOrder(row.order_code)
    currentTotal = orderSpendTotal(order)
  } catch (err) {
    // "not_found" is a conclusion (order deleted/merged on Pancake's side) —
    // stop retrying it. Anything else is transient: leave status='pending' so
    // the next cron tick retries instead of losing the correction forever.
    if (err instanceof PancakeRequestError && err.kind === "not_found") {
      await markStatus(row.id, "failed")
      return "failed"
    }
    console.error("[reconcile-tiktok] order fetch failed", row.order_code, err)
    return "skipped"
  }

  if (currentTotal === row.claimed_total) {
    await markStatus(row.id, "unchanged")
    return "unchanged"
  }

  const { data, error } = await supabase.rpc("reconcile_order_spend", {
    p_order_code: row.order_code,
    p_new_total: currentTotal,
  })

  if (error) {
    console.error(
      "[reconcile-tiktok] reconcile_order_spend failed",
      row.order_code,
      error,
    )
    return "skipped"
  }

  const result = data as ReconcileOrderSpendResult
  console.info(
    `[reconcile-tiktok] ${row.order_code}: ${result.old_total} -> ${result.new_total}` +
      (result.tier_upgraded ? " (tier upgraded)" : ""),
  )
  await markStatus(row.id, "reconciled")
  return "reconciled"
}

async function markStatus(
  id: string,
  status: "reconciled" | "unchanged" | "failed",
) {
  const { error } = await createAdminClient()
    .from("pending_order_reconciliations")
    .update({ status, reconciled_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("[reconcile-tiktok] status update failed", id, status, error)
  }
}

/** The registry the orchestrator walks. Adding a job = adding a line here. */
export const JOBS: Record<JobName, () => Promise<unknown>> = {
  "tier-schedules": runTierSchedules,
  "reconcile-tiktok": runTikTokReconciliation,
}
