import { createAdminClient } from "@/lib/supabase/admin"
import { getOrder, orderSpendTotal } from "@/lib/pancake/client"
import { PancakeRequestError } from "@/lib/pancake/types"
import { verifyCronRequest } from "@/lib/webhook-auth"
import type {
  PendingOrderReconciliationRow,
  ReconcileOrderSpendResult,
} from "@/lib/db-types"

// Re-fetches every TikTok order the Pancake webhook queued (0016) once its
// reconcile_after has passed, and corrects lifetime_spend if Pancake's synced
// total moved since the order was claimed. See pending_order_reconciliations
// and reconcile_order_spend in 0016_tiktok_reconciliation.sql for why this
// touches spend, not points.
//
// Accepts the same auth as tier-schedules — see verifyCronRequest.

export async function POST(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  return run()
}

// Most cron runners (Vercel Cron included) issue a GET.
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  return run()
}

async function run() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("pending_order_reconciliations")
    .select("*")
    .eq("status", "pending")
    .lte("reconcile_after", new Date().toISOString())

  if (error) {
    console.error("[reconcile-tiktok] fetch due rows failed", error)
    return Response.json({ error: "fetch_failed" }, { status: 500 })
  }

  const due = (data ?? []) as PendingOrderReconciliationRow[]
  const results = { reconciled: 0, unchanged: 0, failed: 0, skipped: 0 }

  // Pancake has no batch order lookup, so this is inherently one request per
  // order — sequential on purpose to stay under its rate limit.
  for (const row of due) {
    const outcome = await reconcileOne(row)
    results[outcome]++
  }

  return Response.json({ due: due.length, ...results })
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
