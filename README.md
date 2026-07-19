# QR-Based Loyalty Point App

Customers scan a QR, enter their Pancake POS order code plus the phone number on
that order, and claim loyalty points. Points are per-SKU and scale with the
customer's membership tier. Admins configure tiers, product points, rewards and
the global rules.

Stack: Next.js 16 (App Router, Server Actions) · Supabase (Postgres/Auth/RLS) ·
Pancake POS REST API · Tailwind + shadcn/ui (Base UI) · React Hook Form + Zod.

## Architecture highlights
- **Orders are never stored.** `/claim` fetches the order live from Pancake
  (`src/lib/pancake/client.ts`); only the resulting ledger row and customer state
  are persisted. The same endpoint resolves both order identifiers — the short POS
  `system_id` (e.g. `8661`) and the marketplace `id` (e.g. `2607180W78FJH6`).
- **Atomic, single-use claim** via the `claim_points` Postgres RPC
  (`SECURITY DEFINER`). The partial unique index on `transactions(order_code)` is
  the idempotency guard. Points are recomputed server-side from `product_points`
  × tier multiplier — the client-sent preview is never trusted.
- **The RPC is granted to `service_role` only.** It receives the SKU/quantity list
  the Server Action read from Pancake, so anon must not be able to call it with a
  forged list. `/claim` therefore calls it with the admin client after verifying
  the order itself.
- **Ownership check**: Pancake masks phones as `0****70` (first digit + last two).
  `matchesMask` in `src/lib/phone.ts` compares the entered number against that
  mask; personal point data is only returned after it passes. If an API key ever
  returns unmasked phones, the same function degrades to an exact comparison.
- **Rate limiting**: 5 failed attempts / 15 min per IP and per order code, counted
  in `claim_attempts` (`src/lib/rate-limit.ts`) — serverless-safe, no in-memory state.
- **Restrictive RLS**: anon can read tiers, active rewards and active settings and
  nothing else; no anon writes anywhere.
- **Point calc** is single-sourced: `src/lib/points.ts` (UI preview) mirrors the SQL
  in `supabase/migrations/0003_claim_rpc.sql` (authoritative).

## Local setup
1. `cp .env.example .env.local` and fill Supabase + Pancake values.
2. Apply DB (see below).
3. `npm run dev` → http://localhost:3000 (redirects to `/claim`).

### Pancake credentials
`PANCAKE_API_KEY` and `PANCAKE_SHOP_ID` are server-only. Sanity check a key with:

```bash
curl "https://pos.pages.fm/api/v1/shops/<SHOP_ID>/orders/8661?api_key=<KEY>"
```
An invalid key answers `403 {"message":"api_key is invalid"}`.

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
- `npm test` — vitest unit tests (`calcOrderPoints`, phone masking)
- `npm run lint` — ESLint

## Roadmap
- **Phase 3** — `POST /api/webhooks/pancake`: auto-claim on order status change,
  reusing `claim_points` with `source='webhook'`.
- **Phase 4** — customer accounts (phone + password), `/dashboard` with tier card
  and reward redemption. Signup requires phone + a real order code for that phone
  as ownership proof (no SMS OTP), otherwise anyone could register someone else's
  number and inherit their balance.

## Deployment (Vercel + Supabase Cloud)
- **Test env `mia`** = Vercel Preview; **prod `EVA`** = Vercel Production.
- Set env vars per environment in Vercel (server-side only for
  `SUPABASE_SERVICE_ROLE_KEY`, `PANCAKE_API_KEY`, `WEBHOOK_SECRET`):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `PANCAKE_API_KEY`, `PANCAKE_SHOP_ID`.
- Apply migrations to the test Supabase project first, verify the flow, then apply to prod.
