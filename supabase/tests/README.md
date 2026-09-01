# SQL tests

pgTAP tests for the rules that only exist in the database: the claim and
redemption RPCs, the weighted wheel draw, the constraints that stop data loss,
and the RLS posture. These are deliberately **not** part of `npm test` — they
need Docker and a running local Supabase, and the TypeScript suite must stay
runnable without either. For the same reason they are not in CI.

This is not optional coverage. `src/lib/points.ts` is **types only**: the
TypeScript copy of the point arithmetic was deleted in `0025`, and the
calculation now lives solely inside `claim_points`. The same is true of the
redemption balance check, the wheel draw and the tier grandfathering rule — all
of them run under a row lock no test double can hold. This is the only layer
where those rules can be tested at all.

## Setup

The Supabase CLI ships as a devDependency, so `npm ci` installs it. All you need
is Docker running.

Do **not** run `supabase init` — `config.toml` is committed, and re-initialising
would overwrite it.

## Running

```bash
supabase start          # boots Postgres in Docker, applies migrations + seed
npm run test:db
```

Each file runs inside a transaction that is rolled back, so the local database is
left exactly as `supabase start` produced it.

After changing anything under `migrations/`, re-apply from scratch — these
migrations are edited in place rather than appended to, so an incremental apply
would not pick the changes up:

```bash
supabase db reset
```

If a whole file reports "planned N tests but ran 0", that is almost always a
stale local schema: the fixture insert failed on a column a later migration
added, and pgTAP never got to the first assertion. Reset and try again.

## What is covered

| File | Guards |
|---|---|
| `claim_points_test.sql` | points computed from MONEY (`floor(order_total / vnd_per_point)` × tier multiplier, `0025`); the đồng division floors even when `rounding` is `ceil`; an unmapped SKU earns on money alone rather than zero; one claim per order; refunds never lower `lifetime_spend`; the claim writes the POS link |
| `redeem_test.sql` | the balance is debited by exactly `points_cost` and `lifetime_points` never moves; stock decrements once; the ledger name is a frozen copy; out of stock / not enough points / deactivated item; a `spin` wedge is not merchandise; the tier gate is `>=`, and a NULL `tier_id` floors below every gate |
| `spin_test.sql` | the three clauses of `isDrawable` (`src/lib/spin.ts`), one case each — sold-out gift, zero weight, inactive — since a disagreement there means the odds the admin reads are not the odds the server rolls; the daily limit; a `points` wedge moves both balances, a `gift` wedge takes stock and books nothing, a `none` wedge writes no ledger row at all |
| `adjust_points_test.sql` | a blank reason is refused before anything moves; an overdraw writes no ledger row; a granted tier invents **no** `lifetime_spend` (which would corrupt every percentile); `tier_id` only ever goes up; the first-tier grant branch |
| `checkin_test.sql` | the row is booked against the **Vietnam** calendar day and never behind the UTC one — the assertion that fails if the expression is "simplified" to `current_date`; one per member per day, enforced by the index; a different member may still check in the same day |
| `tier_schedules_test.sql` | **the grandfathering guarantee**: after a raise, a member who already reached the tier keeps it and no tier history is written, because `apply_due_tier_schedules` never touches `public.customers` at all; idempotence; a non-increase is retired with a note rather than left to re-fire forever; ladder collisions are refused by name; `tier_percentile_amount` is discrete and excludes members who never spent |
| `milestones_test.sql` | one claim per rung, enforced by the index rather than the app; the award's frozen name and threshold survive a rename; eligibility is `lifetime_spend`; a milestone is neither merchandise nor a wheel slice; one *active* rung per threshold; an award is **never** retracted when a refund drops spend back below the rung |
| `constraints_test.sql` | one account per Pancake customer; tiers cannot be deleted out from under their members; the claimable-status default; 0đ threshold raises; business config is not anon-readable; the PostgREST roles have the table privileges they need (see `0013_grants.sql`) |
| `rls_test.sql` | `is_admin()` reads `app_metadata` and ignores `user_metadata`; a member reads only their own customer row and their own ledger; a member's `UPDATE` on `public.customers` matches zero rows; the loyalty config is not member-readable; every balance-moving RPC is `service_role` only |

`rls_test.sql` replaces manual cases S-AUTH-09 and S-AUTH-10, which used to read
"open the browser console and try it". `set local role` plus
`set local request.jwt.claims` impersonates a specific member or a specific claim
far more precisely than a console session can.

Privileges are asserted with `has_*_privilege` rather than by reading as `anon`,
because a missing GRANT and a missing policy fail differently — `permission
denied` versus zero rows — and the privilege is what Postgres checks first.

## Writing a new one

Assert against your own fixtures, never against a global `count(*)`. This
database is shared with the Playwright suite (`npm run test:e2e`), which creates
members, grants tiers and spends points and leaves all of it behind — a global
count passes or fails depending on what ran before it, which is the worst kind
of flake to debug.

Fixture thresholds, phone numbers and ids must not collide with `seed.sql`.
Several indexes here are global (`rewards_milestone_threshold_idx` for one), so a
fixture landing on a seeded value fails at INSERT and takes the whole file down
before its first assertion runs.
