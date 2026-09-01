import { verifyCronRequest } from "@/lib/webhook-auth"
import { isJobName, JOB_NAMES, JOBS, type JobName } from "./jobs"

// ONE daily cron for every scheduled job.
//
// Why merged rather than a route per job: Vercel's Hobby plan caps a project at
// two cron schedules, and this app is already at two (tier schedules + TikTok
// reconciliation) with three more coming — the settlement queue, tier decay and
// voucher expiry. Each of those has to be a timer rather than an event because
// nothing HAPPENS at the moment they are due: no webhook fires on the 7th day
// after an order, on the 365th day of a tier, or when a voucher lapses.
//
// The jobs are independent and all run daily, so sequencing them behind one
// schedule costs nothing. The one thing this must not do is let a failing job
// swallow the ones after it, hence the per-job try/catch.
//
// Adding a job: write it in ./jobs.ts and add it to the JOBS registry. Nothing
// here changes, and vercel.json still holds exactly one entry.
//
// `?only=<job>` runs a single job — the manual re-run path that a route per job
// used to provide. Still behind verifyCronRequest, so it is not public.
//
// Accepts either the shared WEBHOOK_SECRET header (manual/internal calls) or
// Vercel Cron's own `Authorization: Bearer CRON_SECRET` — see verifyCronRequest.

export async function POST(req: Request) {
  return handle(req)
}

// Most cron runners (Vercel Cron included) issue a GET.
export async function GET(req: Request) {
  return handle(req)
}

async function handle(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const only = new URL(req.url).searchParams.get("only")
  if (only !== null && !isJobName(only)) {
    return Response.json(
      { error: "unknown_job", known: JOB_NAMES },
      { status: 400 },
    )
  }

  const names: readonly JobName[] = only ? [only] : JOB_NAMES
  const jobs: Record<string, unknown> = {}
  let failed = false

  for (const name of names) {
    try {
      jobs[name] = { ok: true, ...(await runJob(name)) }
    } catch (err) {
      // Caught per job on purpose: one broken job must not cancel the rest.
      // The error is already logged by the job itself; this only records that
      // it did not complete, so the run summary can report it.
      failed = true
      jobs[name] = {
        ok: false,
        error: err instanceof Error ? err.message : "unknown_error",
      }
      console.error(`[cron-daily] ${name} failed`, err)
    }
  }

  // A non-2xx is how the run shows up as failed in the cron dashboard. Every
  // job still ran, and the body says which one broke — returning 200 here would
  // hide a job that has been dead for weeks.
  return Response.json({ jobs }, { status: failed ? 500 : 200 })
}

async function runJob(name: JobName): Promise<Record<string, unknown>> {
  const result = await JOBS[name]()
  return (result ?? {}) as Record<string, unknown>
}
