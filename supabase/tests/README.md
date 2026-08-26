# SQL tests

pgTAP tests for the rules that only exist in the database: the claim RPC, the
constraints that stop data loss, and the RLS posture. These are deliberately
**not** part of `npm test` — they need Docker and a running local Supabase, and
the TypeScript suite must stay runnable without either.

## One-time setup

The Supabase CLI is not a dependency of this repo. Install it, then initialise
the project (this only writes `config.toml`; `migrations/` and `seed.sql` are
left alone):

```bash
brew install supabase/tap/supabase   # or see supabase.com/docs/guides/cli
supabase init
```

## Running

```bash
supabase start          # boots Postgres in Docker, applies migrations + seed
npm run test:db
```

Each file runs inside a transaction that is rolled back, so the local database
is left exactly as `supabase start` produced it.

After changing anything under `migrations/`, re-apply from scratch — these
migrations are edited in place rather than appended to, so an incremental apply
would not pick the changes up:

```bash
supabase db reset
```

## What is covered

| File | Guards |
|---|---|
| `constraints_test.sql` | one account per Pancake customer; tiers cannot be deleted out from under their members; the claimable-status default; 0đ threshold raises; business config is not anon-readable; the PostgREST roles have the table privileges they need (see `0013_grants.sql`) |
| `claim_points_test.sql` | point arithmetic and the unmapped-SKU fallback; one claim per order; refunds never lower `lifetime_spend`; the claim writes the POS link |
| `milestones_test.sql` | one claim per rung, enforced by the index rather than the app; the award's frozen name and threshold survive a rename; eligibility is `lifetime_spend`; a milestone is neither merchandise nor a wheel slice; one *active* rung per threshold |

Privileges are asserted with `has_table_privilege` rather than by reading as `anon`,
because a missing GRANT and a missing policy fail differently — `permission denied` versus
zero rows — and the privilege is what Postgres checks first.
