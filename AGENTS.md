<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Loyalty Point App — project map

QR loyalty-point app. Next.js 16 (App Router) + Supabase + Pancake POS + shadcn/ui (Base UI, NOT Radix).

- **Request middleware**: `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`). Guards `/admin`.
- **Supabase clients**: `src/lib/supabase/{client,server,admin,middleware}.ts`. `admin.ts` is service-role, server-only.
- **Pancake POS**: `src/lib/pancake/{client,types}.ts`, server-only. Orders are fetched live and
  never stored. `getOrder()` accepts either identifier (`system_id` or `id`); the canonical
  `id` is what gets persisted as `order_code`.
- **Claim flow**: `src/app/(customer)/claim/` — `actions.ts` (`lookupOrder`, `verifyPhone`,
  `submitClaim`), `claim-form.tsx`. Server data reads live in `src/lib/loyalty.ts`.
- **Admin**: `src/app/admin/` — `login/`, `settings/`, `tiers/`, `products/`, `rewards/`,
  `customers/`, `transactions/`, protected `layout.tsx`.
- **DB**: `supabase/migrations/*.sql` + `supabase/seed.sql`. Claim atomicity lives in the
  `claim_points` RPC — the ONLY write path for a claim. Never bypass it. It is granted to
  `service_role` ONLY (it trusts the item list it is handed) — call it with `createAdminClient()`.
- **Point calc**: `src/lib/points.ts` MUST stay in sync with the SQL in `0003_claim_rpc.sql`.
- **Ownership gate**: `matchesMask` in `src/lib/phone.ts` (Pancake masks phones as `0****70`).
  Never return customer point data before it passes. Rate limiting: `src/lib/rate-limit.ts`.
- **i18n**: cookie-driven, Vietnamese default. `src/lib/i18n/messages/en.ts` is the source of
  truth; `vi.ts` is typed against it, so add keys to both.
- shadcn Button is Base UI: NO `asChild`. Use `buttonVariants` on a Link (see `src/components/page-link.tsx`).
