import "server-only"

import { headers } from "next/headers"

import { createAdminClient } from "@/lib/supabase/admin"

// Brute-force guard for signup and sign-in. Order codes are partly sequential (Pancake
// system_id) and the masked-phone check only reveals 3 digits, so throttling is
// what keeps guessing expensive. Counters live in Postgres — serverless
// instances share nothing in memory.

const WINDOW_MINUTES = 15
const MAX_FAILURES_PER_IP = 5
const MAX_FAILURES_PER_ORDER = 5

// The throttle is only worth as much as this value. `x-forwarded-for` is
// APPENDED to as a request crosses proxies, so its LEFTMOST entry is whatever
// the client claimed — rotate a fake one per request on a host that appends
// rather than replaces and the limit is gone. Prefer headers the platform
// writes itself, and if only XFF is available take the RIGHTMOST entry: the hop
// nearest us is the one hop no client can forge.
export async function getClientIp(): Promise<string> {
  const h = await headers()

  const vercel = h.get("x-vercel-forwarded-for")?.trim()
  if (vercel) return vercel

  const real = h.get("x-real-ip")?.trim()
  if (real) return real

  const forwarded = h.get("x-forwarded-for")
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean)
    if (hops.length) return hops[hops.length - 1]!
  }

  return "unknown"
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
