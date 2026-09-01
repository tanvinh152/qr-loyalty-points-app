-- Schema-level guarantees that no amount of TypeScript can provide.
--
-- Every assertion here corresponds to a way the app was found to lose data:
-- a customer disappearing from the webhook, a tier vanishing under its members,
-- a blank form field becoming a 0đ threshold. The database is the last place
-- these can still be stopped, so this is where they are pinned.
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(16);

-- ---------------------------------------------------------------- #1 ----
-- One POS customer backs exactly one account. Without the unique index two
-- concurrent signups both clear the application gate, both write, and
-- getCustomerByPancakeId().maybeSingle() then errors on multiple rows —
-- after which every future order for that person is silently dropped.

insert into public.customers (phone, pancake_customer_id)
values ('0900000001', 'pos-shared');

select throws_ok(
  $$insert into public.customers (phone, pancake_customer_id)
    values ('0900000002', 'pos-shared')$$,
  '23505',
  null,
  'a second account cannot claim the same Pancake customer'
);

-- The index is partial: everyone who has not linked yet is NULL, and NULLs
-- must stay unlimited or only one customer could ever exist unlinked.
select lives_ok(
  $$insert into public.customers (phone, pancake_customer_id)
    values ('0900000003', null), ('0900000004', null)$$,
  'any number of customers may sit unlinked'
);

-- ---------------------------------------------------------------- #2 ----
-- Claimable statuses: 3 = delivered, 16 = received_money. A default of just
-- {3} drops every order that has already moved on to "received money", with
-- no error and nothing in the logs. Must equal DEFAULT_CLAIMABLE_STATUSES in
-- src/lib/pancake/order-status.ts.

insert into public.loyalty_settings (rounding, vnd_per_point, is_active)
values ('floor', 1000, false);

select is(
  (select claimable_statuses
     from public.loyalty_settings
    where is_active = false
    order by updated_at desc
    limit 1),
  '{3,16}'::integer[],
  'a settings row defaults to both settled statuses'
);

-- ---------------------------------------------------------------- #3 ----
-- tier_id is the highest tier ever held and nothing may lower it. Deleting a
-- tier out from under its members would do exactly that: their multiplier
-- would fall back to whatever their spend implies, and the tier history would
-- be orphaned. `on delete restrict` turns that into a loud failure.

insert into public.customers (phone, tier_id)
values (
  '0900000005',
  (select id from public.membership_tiers where name = 'Vàng')
);

select throws_ok(
  $$delete from public.membership_tiers where name = 'Vàng'$$,
  '23503',
  null,
  'a tier still held by a member cannot be deleted'
);

-- restrict is not a blanket ban: the constraint is about members, not tiers.
select lives_ok(
  $$delete from public.membership_tiers where name = 'Ruby'$$,
  'a tier nobody holds is still deletable'
);

-- No policy may grant DELETE either: the five-tier ladder is fixed, and the
-- admin UI has no delete affordance, so PostgREST must not offer one.
select is(
  (select count(*)::int
     from pg_policies
    where schemaname = 'public'
      and tablename = 'membership_tiers'
      and cmd in ('ALL', 'DELETE')),
  0,
  'no RLS policy exposes DELETE on membership_tiers'
);

-- ---------------------------------------------------------------- #4 ----
-- A blank "amount" field used to coerce to 0 on the way through zod. Applying
-- a 0đ threshold promotes the entire member base at once, so the database
-- refuses it even if validation ever regresses again.

select throws_ok(
  $$insert into public.tier_threshold_schedules
      (tier_id, mode, target_amount, effective_at)
    values (
      (select id from public.membership_tiers where name = 'Bạch kim'),
      'amount', 0, now() + interval '1 day')$$,
  '23514',
  null,
  'a 0đ threshold raise is rejected'
);

select lives_ok(
  $$insert into public.tier_threshold_schedules
      (tier_id, mode, target_amount, effective_at)
    values (
      (select id from public.membership_tiers where name = 'Bạch kim'),
      'amount', 9000000, now() + interval '1 day')$$,
  'a real threshold raise is accepted'
);

-- ---------------------------------------------------------------- #5 ----
-- Rounding, the đồng-per-point divisor and the claimable status set are
-- business config. Nothing outside the admin screens reads this table — the
-- claim path uses the service-role client.

select is(
  (select count(*)::int
     from pg_policies
    where schemaname = 'public'
      and tablename = 'loyalty_settings'
      and 'anon' = any(roles)),
  0,
  'no policy exposes loyalty_settings to anon'
);

-- Asserted at the GRANT level, not by reading as anon: Postgres checks
-- privileges before policies, so a missing grant and a missing policy fail very
-- differently (`permission denied` vs zero rows). Both must hold, and the
-- privilege is the one that is checked first.
select ok(
  not has_table_privilege('anon', 'public.loyalty_settings', 'select'),
  'anon has no privilege to read loyalty_settings'
);

-- ---------------------------------------------------------------- #6 ----
-- Privileges, not policies. A database built from these migrations alone had no
-- GRANT at all, so every PostgREST role got `permission denied` on every table
-- and none of the RLS above was ever reached. See 0013_grants.sql.

select ok(
  has_table_privilege('service_role', 'public.customers', 'select')
    and has_table_privilege('service_role', 'public.customers', 'insert')
    and has_table_privilege('service_role', 'public.transactions', 'insert'),
  'service_role can actually reach the tables it writes'
);

-- BYPASSRLS is not a substitute for a grant: skipping row security still
-- requires table privileges. Both have to be true.
select ok(
  (select rolbypassrls from pg_roles where rolname = 'service_role'),
  'service_role still bypasses RLS'
);

select ok(
  has_table_privilege('anon', 'public.membership_tiers', 'select')
    and has_table_privilege('anon', 'public.rewards', 'select'),
  'anon can read the two tables its policies are written for'
);

-- ---------------------------------------------------------------- #7 ----
-- The email is the credential Supabase actually signs the member in with, and
-- `auth.users.email` is unique. A `customers` row that shares an address with
-- another one describes an account that cannot exist, and sign-in resolves
-- phone -> customers.email, so the duplicate would silently hand two members
-- the same login. See 0014_real_email_identity.sql.

insert into public.customers (phone, email)
values ('0900000006', 'member@example.com');

-- Case-insensitive, because a mailbox is. Signup lower-cases before writing;
-- this index is what catches anything that does not.
select throws_ok(
  $$insert into public.customers (phone, email)
    values ('0900000007', 'Member@Example.COM')$$,
  '23505',
  null,
  'two accounts cannot share one address, whatever the casing'
);

-- Partial, like the pancake index above: a row written by claim_points before
-- the member ever signed up has no address yet, and there may be many of those.
select lives_ok(
  $$insert into public.customers (phone, email)
    values ('0900000008', null), ('0900000009', null)$$,
  'any number of customers may sit without an address'
);

-- Same posture as claim_points / update_customer_profile: the orphan lookup can
-- hand back an auth user id, so nothing but the service role may call it.
select ok(
  not has_function_privilege(
    'anon', 'public.find_orphan_auth_user(text)', 'execute')
    and not has_function_privilege(
      'authenticated', 'public.find_orphan_auth_user(text)', 'execute')
    and has_function_privilege(
      'service_role', 'public.find_orphan_auth_user(text)', 'execute'),
  'only service_role may look up an orphaned auth user'
);

select * from finish();
rollback;
