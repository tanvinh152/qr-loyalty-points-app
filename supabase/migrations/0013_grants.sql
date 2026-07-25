-- Table privileges for the PostgREST roles.
--
-- Nothing before this file ever issued a GRANT, and a database built purely from
-- these migrations is therefore unusable: `supabase db reset` followed by any
-- query answers `permission denied for table …` for anon, authenticated AND
-- service_role alike. The RLS policies in 0002/0005/0007/0010 were unreachable —
-- Postgres checks the GRANT first and never gets as far as the policy.
--
-- Why it was invisible: the default privileges Supabase sets for the `postgres`
-- role in `public` are `Dxtm` (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) — no
-- SELECT, INSERT, UPDATE or DELETE. Tables created by a migration are owned by
-- `postgres`, so they inherit exactly that. Older projects were built when the
-- default was `ALL`, which is why an existing database keeps working while a
-- fresh reset does not.
--
-- The split below follows the policies that already exist: GRANTs decide which
-- VERBS a role may attempt, RLS decides which ROWS it gets. Both must line up,
-- so a policy added later needs its grant added here too.

-- ---- anon ----
-- Only the two tables that carry an anon SELECT policy. Everything else —
-- loyalty_settings, product_points, the ledger — is business config or member
-- data and stays unreachable at the privilege level as well as the policy one.
grant select on public.membership_tiers to anon;
grant select on public.rewards          to anon;

-- ---- authenticated ----
-- Readable subject to RLS. The admin-only tables are listed too: their policies
-- are `using (is_admin())`, so a customer session simply matches no rows.
grant select on
  public.membership_tiers,
  public.rewards,
  public.customers,
  public.transactions,
  public.claim_attempts,
  public.loyalty_settings,
  public.product_points,
  public.support_requests,
  public.tier_threshold_schedules,
  public.customer_tier_history
to authenticated;

-- Writes the admin server actions perform through the RLS-scoped client.
grant insert, update, delete on
  public.rewards,
  public.product_points,
  public.loyalty_settings,
  public.support_requests,
  public.tier_threshold_schedules
to authenticated;

-- UPDATE only, matching "admin update tiers" and "admin update customers".
-- No DELETE on membership_tiers: dropping a tier demotes everyone holding it.
grant update on public.membership_tiers to authenticated;
grant update on public.customers        to authenticated;

-- ---- service_role ----
-- The app's actual write path. It has BYPASSRLS but that is worthless without
-- the grant — bypassing row security still requires table privileges.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---- future tables ----
-- So the next migration does not silently recreate this hole. Scoped to the
-- role that runs migrations; each new table still needs its own anon /
-- authenticated grant above, deliberately, rather than getting one by default.
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
