import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { webhookOrderSchema } from "@/lib/schemas"

export const runtime = "nodejs"

// Verify HMAC-SHA256 of the raw body against the x-webhook-signature header.
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!verifySignature(rawBody, request.headers.get("x-webhook-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 422 })
  }

  const parsed = webhookOrderSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const supabase = createAdminClient()
  // Idempotent: replays with the same external_order_id update, not duplicate.
  const { error } = await supabase.from("orders").upsert(
    {
      external_order_id: parsed.data.external_order_id,
      order_code: parsed.data.order_code,
      total: parsed.data.total,
    },
    { onConflict: "external_order_id" }
  )

  if (error) {
    return NextResponse.json({ error: "upsert failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
