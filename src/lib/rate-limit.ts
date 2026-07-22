import "server-only"

import { headers } from "next/headers"

import { createAdminClient } from "@/lib/supabase/admin"

// Brute-force guard for /claim. Order codes are partly sequential (Pancake
// system_id) and the masked-phone check only reveals 3 digits, so throttling is
// what keeps guessing expensive. Counters live in Postgres — serverless
// instances share nothing in memory.

const WINDOW_MINUTES = 15
const MAX_FAILURES_PER_IP = 5
const MAX_FAILURES_PER_ORDER = 5

export async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return h.get("x-real-ip")?.trim() || "unknown"
}

function windowStart(): string {
  return new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
}

// True when the caller is over budget and should be refused before any Pancake
// call happens. Fails OPEN on a DB error: losing the throttle beats taking the
// whole claim flow down.
export async function isRateLimited(
  ip: string,
  orderCode?: string,
): Promise<boolean> {
  const supabase = createAdminClient()
  const since = windowStart()

  const { count, error } = await supabase
    .from("claim_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("succeeded", false)
    .gte("created_at", since)

  if (error) return false
  if ((count ?? 0) >= MAX_FAILURES_PER_IP) return true

  if (orderCode) {
    const { count: orderCount, error: orderErr } = await supabase
      .from("claim_attempts")
      .select("*", { count: "exact", head: true })
      .eq("order_code", orderCode)
      .eq("succeeded", false)
      .gte("created_at", since)

    if (!orderErr && (orderCount ?? 0) >= MAX_FAILURES_PER_ORDER) return true
  }

  return false
}

export async function recordAttempt(
  ip: string,
  orderCode: string | null,
  succeeded: boolean,
): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from("claim_attempts")
    .insert({ ip, order_code: orderCode, succeeded })
}
