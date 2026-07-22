import { createClient } from "@/lib/supabase/server"

// Support-request reads for the admin inbox. They live here rather than inline
// in the page because the "last 7 days" window needs the current time, and a
// component may not call an impure function during render.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type SupportCounts = {
  open: number
  closed: number
  /** Filed in the last seven days, whatever their status. */
  week: number
}

/**
 * Head-only counts for the inbox stat row. RLS ("admin manage support
 * requests", 0007) scopes them, so a non-admin session sees zeros.
 */
export async function getSupportCounts(): Promise<SupportCounts> {
  const supabase = await createClient()
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()

  const [open, closed, week] = await Promise.all([
    supabase
      .from("support_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("support_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "closed"),
    supabase
      .from("support_requests")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo),
  ])

  return {
    open: open.count ?? 0,
    closed: closed.count ?? 0,
    week: week.count ?? 0,
  }
}
