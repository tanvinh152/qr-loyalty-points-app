<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Loyalty Point App — project map

QR loyalty-point app. Next.js 16 (App Router) + Supabase + shadcn/ui (Base UI, NOT Radix).

- **Request middleware**: `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`). Guards `/admin`.
- **Supabase clients**: `src/lib/supabase/{client,server,admin,middleware}.ts`. `admin.ts` is service-role, server-only.
- **Claim flow**: `src/app/(customer)/claim/` — `actions.ts` (`validateOrder`, `submitClaim`), `claim-form.tsx`.
- **Admin**: `src/app/admin/` — `login/`, `settings/`, `customers/`, `transactions/`, protected `layout.tsx`.
- **Webhook**: `src/app/api/webhooks/orders/route.ts` (HMAC verify, idempotent upsert).
- **DB**: `supabase/migrations/*.sql` + `supabase/seed.sql`. Claim atomicity lives in the
  `claim_points` RPC — the ONLY write path for a claim. Never bypass it.
- **Point calc**: `src/lib/points.ts` MUST stay in sync with the SQL in `0003_claim_rpc.sql`.
- shadcn Button is Base UI: NO `asChild`. Use `buttonVariants` on a Link (see `src/components/page-link.tsx`).
