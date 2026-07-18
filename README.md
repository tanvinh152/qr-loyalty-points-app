# QR-Based Loyalty Point App

Customers scan a QR, enter their order code, and claim loyalty points. Admins
configure the point logic and view customers/transactions. Orders are mock-seeded
now; a webhook adapter syncs real orders later.

Stack: Next.js 16 (App Router, Server Actions) · Supabase (Postgres/Auth/RLS) ·
Tailwind + shadcn/ui (Base UI) · React Hook Form + Zod.

## Architecture highlights
- **Atomic, single-use claim** via the `claim_points` Postgres RPC (`SECURITY DEFINER`).
  The guarded `UPDATE ... WHERE status='pending' RETURNING` + `unique(order_id)` on the
  ledger prevent double-claims and races. Points are recomputed server-side — the
  client-sent preview is never trusted.
- **Restrictive RLS**: anon can only read `orders` + active `point_settings`; no anon
  writes anywhere. `customers` has no anon policy (no phone enumeration).
- **Point calc** is single-sourced: `src/lib/points.ts` (UI preview) mirrors the SQL in
  `supabase/migrations/0003_claim_rpc.sql` (authoritative).

## Local setup
1. `cp .env.example .env.local` and fill Supabase values (Project Settings → API).
2. Apply DB (see below).
3. `npm run dev` → http://localhost:3000 (redirects to `/claim`).

## Database
Migrations live in `supabase/migrations/` (apply in order) and seed in `supabase/seed.sql`.

Apply via Supabase SQL Editor (paste each file), or the CLI:
```bash
supabase link --project-ref <ref>
supabase db push          # applies migrations
# then paste supabase/seed.sql in the SQL editor, or:
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Create an admin user (Supabase → Authentication → Add user, email+password) to log in
at `/admin/login`.

## Scripts
- `npm run dev` — dev server
- `npm run build` — production build
- `npm test` — vitest unit tests (`calcPoints`)
- `npm run lint` — ESLint

## Webhook testing (Bruno)
Open the `bruno/` collection, select the `local` environment, set `webhookSecret` to
match `WEBHOOK_SECRET`. Requests: `valid-order` (200), `replay-idempotent` (200, no dup),
`bad-signature` (401), `bad-body` (422).

## Deployment (Vercel + Supabase Cloud)
- **Test env `mia`** = Vercel Preview; **prod `EVA`** = Vercel Production.
- Set env vars per environment in Vercel (server-side only for `SUPABASE_SERVICE_ROLE_KEY`
  and `WEBHOOK_SECRET`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`.
- Apply migrations to the test Supabase project first, verify the flow, then apply to prod.
- Point the third-party webhook at `https://<domain>/api/webhooks/orders` with an
  `x-webhook-signature` HMAC-SHA256 (hex) of the raw body keyed by `WEBHOOK_SECRET`.
