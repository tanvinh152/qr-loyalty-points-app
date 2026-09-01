# QR-Based Loyalty Point App

Customers scan a QR, enter their Pancake POS order code plus the phone number on
that order, and claim loyalty points. Points are earned on MONEY — a fixed
đồng-per-point rate, scaled by the customer's membership tier. Admins configure
tiers, rewards and the global rules.

Stack: Next.js 16 (App Router, Server Actions) · Supabase (Postgres/Auth/RLS) ·
Pancake POS REST API · Tailwind + shadcn/ui (Base UI) · React Hook Form + Zod.

## Architecture highlights

- **Orders are never stored.** `/claim` fetches the order live from Pancake
  (`src/lib/pancake/client.ts`); only the resulting ledger row and customer state
  are persisted. The same endpoint resolves both order identifiers — the short POS
  `system_id` (e.g. `8661`) and the marketplace `id` (e.g. `2607180W78FJH6`).
- **Atomic, single-use claim** via the `claim_points` Postgres RPC
  (`SECURITY DEFINER`). The partial unique index on `transactions(order_code)` is
  the idempotency guard. Points are recomputed server-side as
  `floor(order_total / vnd_per_point) × tier multiplier`
  (`0025_spend_based_points.sql`) — the client-sent preview is never trusted. The
  đồng division always floors, whatever `rounding` says; that setting governs the
  multiplier step alone.
- **The RPC is granted to `service_role` only.** It receives the order total the
  Server Action read from Pancake, so anon must not be able to call it with a
  forged figure. `/claim` therefore calls it with the admin client after verifying
  the order itself.
- **Ownership check**: `matchesOrderPhones` in `src/lib/phone.ts`, against every
  number the order carries. Pancake masks phones as `0****70` (first digit + last
  two), but not what it has been told — a record it knows comes back as
  `["0****52", "0376733152"]`. Whenever a real number is present it is the only
  thing compared, exactly; the mask is the fallback for records that have none,
  and signing up against one of those writes the real number back, so that record
  moves to the exact-match path permanently.
- **Rate limiting**: 5 failed attempts / 15 min per IP and per order code, counted
  in `claim_attempts` (`src/lib/rate-limit.ts`) — serverless-safe, no in-memory state.
- **Restrictive RLS**: anon can read tiers, active rewards and active settings and
  nothing else; no anon writes anywhere.
- **Point calc** is single-sourced in SQL: the arithmetic lives only in the
  `claim_points` RPC (`supabase/migrations/0011_claim_spend.sql`). `src/lib/points.ts`
  is types now — do not reintroduce a TypeScript copy.

## Local setup

1. `cp .env.example .env.local` and fill Supabase + Pancake values.
2. Apply DB (see below).
3. `npm run dev` → http://localhost:3000 (redirects to `/login` — the QR landing).

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
- `npm test` — vitest, both projects (see Testing below)
- `npm run test:watch` — vitest in watch mode
- `npm run test:coverage` — vitest with a v8 coverage report in `coverage/`
- `npm run test:db` — pgTAP against a local Supabase (needs Docker + `supabase start`)
- `npm run test:e2e` — Playwright end-to-end specs from `e2e/`
- `npm run test:e2e:ui` — the same, in Playwright's inspector
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint

## Testing

Three layers, deliberately separate. Only the first runs in CI.

### 1. vitest — the fast gate

`npm test`. Two projects, split by file extension:

- **`unit`** — `src/**/*.test.ts`, node environment. Pure logic (points, phone
  masking, tier resolution, the zod schema factories, the pure half of the Pancake
  client) plus the server actions and route handlers, whose collaborators are
  mocked at the module boundary.
- **`component`** — `src/**/*.test.tsx`, jsdom. Client components rendered through
  `renderWithProviders` (`src/test/render.tsx`), which wraps the i18n and theme
  providers with the real message catalogs. `src/test/setup.ts` polyfills what
  jsdom lacks (`matchMedia`, `IntersectionObserver`, …) and mocks `next/navigation`
  against the shared router in `src/test/route.ts`.

Shared harness, all under `src/test/` and excluded from coverage:

- `supabase.ts` — `createSupabaseFake()`, a recording stand-in for both Supabase
  clients. It records `.eq()`/`.gte()`/… rather than filtering: what it exists to
  test is the ACTION (does it prove the session, does it reach for the right RPC,
  does it map the error code a member sees), not the query planner.
- `messages.ts` — `keyed()`, a message catalog where every lookup answers with its
  own key, so a server-action assertion names the RULE instead of pinning a
  Vietnamese sentence. Component tests do the opposite and use the real `en`
  catalog, because what a member can read is the thing under test there.
- `factories.ts` — complete row builders, so a test names only the column it is
  actually about.

No Docker, no network, no environment variables — everything is module-mocked.
Server Components cannot be rendered by Testing Library, so only `"use client"`
files are component-testable. Run one project with `npx vitest run --project=unit`.

`tsconfig.json` includes test files, so a type error in a test fails
`npm run build` — `npm run typecheck` is there to catch it first. It is also what
enforces `vi.ts` staying in step with `en.ts`, since `vi` is declared as `Messages`.

### 2. pgTAP — the money layer

`npm run test:db`, after `supabase start`. Nine files under `supabase/tests/`; see
`supabase/tests/README.md`.

This layer is not optional coverage. **`src/lib/points.ts` is types only** — the
TypeScript copy of the point arithmetic was deleted in 0025, and the calculation
now lives solely inside the `claim_points` RPC. The same is true of the redemption
balance check, the weighted wheel draw and the tier grandfathering rule: all of
them run under a row lock that no vitest mock can hold. pgTAP is the only place
those rules can be tested at all.

Needs Docker, so it is deliberately kept out of `npm test` and out of CI.

### 3. Playwright — the seams

`npm run test:e2e` (`npm run test:e2e:ui` for the inspector). Specs live in `e2e/`
at the repo root, **not** under `src/` — vitest's projects are globbed by
extension, so a spec inside `src/` would be one rename away from being run in a
bare node environment.

E2E covers only what the lower layers cannot: a real session, the real proxy
guard and real RLS, together in a browser. It never touches `/register` or
`/claim` — both need a live Pancake order code, orders are fetched live and never
stored, and `/register` consumes the order it proves ownership with. The two test
accounts are provisioned by `e2e/global-setup.ts` through the service-role client,
using the same `auth.admin.createUser` call production signup uses.

### CI

`.github/workflows/ci.yml` runs `lint`, `typecheck` and `test` on every push to
`main` and every pull request — the vitest layer only. pgTAP and Playwright are
local gates; both would need Docker or repo secrets that do not exist yet. The
workflow pins Node 22.x, and since the repo has no `engines` field or `.nvmrc`
that pin is currently the only written-down statement of the version.

## Customer accounts (Phase 4)

- **Auth is phone + password.** Supabase Auth's password provider is email-keyed, so
  `/register` requires the member's real email and stores it in both `auth.users.email`
  and `customers.email`; `signIn` takes a phone, looks that address up, and hands it to
  `signInWithPassword`. The login form still has one field, and there is no SMS provider,
  no OTP cost. (Before `0014` the address was a synthetic `<phone>@CUSTOMER_EMAIL_DOMAIN`
  alias.) Signup calls `auth.admin.createUser({ email_confirm: true })` with the
  service-role client: nothing is ever mailed — no confirmation, no password reset — and
  no Supabase auth setting needs changing.
- **Ownership proof**: `/register` always demands a recent order code whose phone matches
  the one being registered (`matchesOrderPhones` — see the ownership check above). It is
  both the ownership gate and the only source of `pancake_customer_id`, so signup cannot
  complete without it. It also auto-claims that order and fills in the member's real name
  and phone on the POS record wherever Pancake holds only a mask.
- **Roles**: admins are `app_metadata.role = 'admin'` (service-role writable only).
  `0005_roles_and_customer_rls.sql` backfills every existing auth user as an admin and
  rewrites the RLS policies around `public.is_admin()`; customers get self-scoped reads
  on their own `customers` row and `transactions`. New admins need the claim set
  manually, e.g. `update auth.users set raw_app_meta_data = raw_app_meta_data ||
'{"role":"admin"}'::jsonb where email = '…';`.
- **Redemption** goes through the `redeem_reward` RPC (`0006_redeem_rpc.sql`), which locks
  the reward row before checking stock and balance. `lifetime_points` is never reduced, so
  spending cannot demote a tier.
- Routes: `/login`, `/register`, and the account area `/dashboard`, `/rewards`, `/history`
  (guarded in `src/lib/supabase/middleware.ts`).

## Roadmap

- Zalo OTP as the signup ownership proof, replacing the order-code check.
- Self-serve password reset (today `/login` tells the customer to contact support).

## Deployment (Vercel + Supabase Cloud)

- **Test env `mia`** = Vercel Preview; **prod `EVA`** = Vercel Production.
- Set env vars per environment in Vercel (server-side only for
  `SUPABASE_SERVICE_ROLE_KEY`, `PANCAKE_API_KEY`, `WEBHOOK_SECRET`):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `PANCAKE_API_KEY`, `PANCAKE_SHOP_ID`.
- Apply migrations to the test Supabase project first, verify the flow, then apply to prod.
