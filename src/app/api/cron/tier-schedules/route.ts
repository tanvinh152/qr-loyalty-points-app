import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSecret } from "@/lib/webhook-auth"
import type { ApplyScheduleResult } from "@/lib/db-types"

// Applies any tier threshold raise whose effective date has arrived.
//
// The RPC is idempotent (`applied_at is null` + `for update skip locked`), so
// running this more often than needed is harmless — and it is also called
// fire-and-forget when an admin opens /admin/tiers, which is what makes the
// feature work on a deployment with no cron configured at all. The cron is the
// guarantee that a raise lands on its date even if nobody visits.
//
// Shares WEBHOOK_SECRET with the Pancake endpoint rather than owning a second
// one: both are "an unauthenticated caller must not be able to poke this", and
// two secrets to rotate is one more chance to get a rotation wrong.

export async function POST(req: Request) {
  if (!verifyWebhookSecret(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  return run()
}

// Most cron runners (Vercel Cron included) issue a GET.
export async function GET(req: Request) {
  if (!verifyWebhookSecret(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  return run()
}

async function run() {
  const { data, error } = await createAdminClient().rpc(
    "apply_due_tier_schedules",
  )

  if (error) {
    console.error("[tier-schedules] apply failed", error)
    return Response.json({ error: "apply_failed" }, { status: 500 })
  }

  const result = data as ApplyScheduleResult
  const applied = result?.applied ?? []
  // Logged individually: a threshold move is the kind of thing someone will want
  // to reconstruct months later from the logs alone.
  for (const row of applied) {
    console.info(
      `[tier-schedules] ${row.tier_name ?? row.tier_id}: ${row.from} -> ${row.to}`,
    )
  }
  return Response.json({ applied })
}
