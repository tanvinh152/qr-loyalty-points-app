import "server-only"

import { timingSafeEqual } from "node:crypto"

// Pancake does NOT sign its webhooks. The shop config exposes only
// `webhook_headers` — arbitrary STATIC headers — so the strongest scheme
// available is a shared secret sent on every delivery. Constant-time compare so
// the endpoint cannot be turned into a byte-at-a-time oracle for the secret.

export const WEBHOOK_SECRET_HEADER = "x-webhook-secret"

export function verifyWebhookSecret(req: Request): boolean {
  const expected = process.env.WEBHOOK_SECRET
  // Fail closed: an unset secret must never mean "everyone is authorized".
  if (!expected) return false

  const provided = req.headers.get(WEBHOOK_SECRET_HEADER)
  if (!provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, which itself leaks the length —
  // unavoidable, and the length of a random secret is not the secret.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
