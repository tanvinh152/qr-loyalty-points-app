import "server-only"

import { timingSafeEqual } from "node:crypto"

// Pancake does NOT sign its webhooks. The shop config exposes only
// `webhook_headers` — arbitrary STATIC headers — so the strongest scheme
// available is a shared secret sent on every delivery. Constant-time compare so
// the endpoint cannot be turned into a byte-at-a-time oracle for the secret.

export const WEBHOOK_SECRET_HEADER = "x-webhook-secret"

export function verifyWebhookSecret(req: Request): boolean {
  return timingSafeHeaderEqual(
    req.headers.get(WEBHOOK_SECRET_HEADER),
    process.env.WEBHOOK_SECRET,
  )
}

// Cron routes have no Pancake-imposed header shape, so they can accept either
// a manual/internal call (same header as the Pancake webhook) or a real
// Vercel Cron invocation, which sends `Authorization: Bearer $CRON_SECRET`
// automatically once CRON_SECRET is set as a project env var. The Pancake
// webhook itself stays on verifyWebhookSecret only — it will never send Bearer.
export function verifyCronRequest(req: Request): boolean {
  if (verifyWebhookSecret(req)) return true

  const auth = req.headers.get("authorization")
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  return timingSafeHeaderEqual(provided, process.env.CRON_SECRET)
}

function timingSafeHeaderEqual(
  provided: string | null,
  expected: string | undefined,
): boolean {
  // Fail closed: an unset secret must never mean "everyone is authorized".
  if (!expected || !provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, which itself leaks the length —
  // unavoidable, and the length of a random secret is not the secret.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
