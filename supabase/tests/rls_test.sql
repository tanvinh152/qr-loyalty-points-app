-- The RLS posture, asserted as a database fact.
--
-- Manual cases S-AUTH-09 and S-AUTH-10 in docs/test-cases.md used to say "open
-- the browser console and try it". That is a database assertion wearing a
-- browser costume — and a weak one, because a console session cannot easily be
-- made to impersonate a *specific* member or a *specific* claim. Here
-- `set local role` plus `set local request.jwt.claims` does exactly that, inside
-- a transaction that rolls back.
--
-- Privileges are asserted with has_*_privilege rather than by trying the call:
-- a missing GRANT and a missing POLICY fail differently (permission denied
-- versus zero rows), and the privilege is what Postgres checks first.
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(13);

-- customers.auth_user_id is a real foreign key into auth.users, so the two
-- identities have to exist before the rows that point at them. Inserted with the
-- bare minimum: everything else on auth.users has a default, and none of it is
-- what the policies read.
insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-0000000000a1', 'a1@test.local'),
  ('00000000-0000-4000-8000-0000000000a2', 'a2@test.local');

insert into public.customers (id, auth_user_id, phone, current_points, lifetime_spend)
values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-0000000000a1', '0917000001', 500, 1000000),
  ('aaaaaaaa-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-0000000000a2', '0917000002', 900, 5000000);

insert into public.transactions (customer_id, phone, type, amount, source)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '0917000001', 'EARN', 500, 'claim'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '0917000002', 'EARN', 900, 'claim');

-- ---------------------------------------------------------------- #1 ----
-- is_admin() reads app_metadata, which only the service role can write. Every
-- admin policy in the schema is built on it, so it is worth proving directly.

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","app_metadata":{}}';

select ok(not public.is_admin(), 'an ordinary member is not an admin');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a9","app_metadata":{"role":"admin"}}';

select ok(public.is_admin(), 'the app_metadata role claim is what makes an admin');

-- user_metadata is writable by the user themselves. Reading the role from there
-- would let any member mint themselves an admin session.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","user_metadata":{"role":"admin"}}';

select ok(not public.is_admin(), 'a role in user_metadata grants nothing');

-- ---------------------------------------------------------------- #2 ----
-- A member sees their own row and nobody else's.

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","app_metadata":{}}';

select is(
  (select count(*)::int from public.customers),
  1,
  'a member reads exactly one customers row: their own'
);

select is(
  (select phone from public.customers),
  '0917000001',
  'and it is theirs'
);

-- ---------------------------------------------------------------- #3 ----
-- S-AUTH-09. There is NO customer write policy on public.customers — the only
-- write paths are the service-role RPCs. An UPDATE therefore matches no rows
-- rather than being refused, which is the quieter and more dangerous-looking
-- of the two failure modes, so it is asserted explicitly.

update public.customers set current_points = 999999
 where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select current_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  500,
  'a member cannot raise their own balance: no write policy exists'
);

-- ---------------------------------------------------------------- #4 ----
-- C-HIS-05. The ledger is scoped the same way, through the customers row.

select is(
  (select count(*)::int from public.transactions),
  1,
  'a member reads only their own ledger rows'
);

select is(
  (select amount from public.transactions),
  500,
  'and none of another member''s'
);

-- ---------------------------------------------------------------- #5 ----
-- Business configuration is not public. loyalty_settings carries the exchange
-- rate and the spin odds budget; the member app never needs to read it.

select is(
  (select count(*)::int from public.loyalty_settings),
  0,
  'a member cannot read the loyalty configuration'
);

reset role;

-- ---------------------------------------------------------------- #6 ----
-- S-AUTH-10. The write RPCs trust whatever they are handed, which is safe only
-- while nothing but the service role may call them. This is the grant, not the
-- policy — Postgres checks it first, and a missing one fails with a different
-- message than a missing policy.

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_points(text,text,text,text,text,jsonb,text,numeric)',
    'execute'),
  'a signed-in member cannot call claim_points'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_points(text,text,text,text,text,jsonb,text,numeric)',
    'execute'),
  'nor can an anonymous visitor'
);

select ok(
  not has_function_privilege('authenticated', 'public.redeem_reward(uuid,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.adjust_points(uuid,integer,integer,uuid,text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.spin_wheel(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.checkin(uuid)', 'execute'),
  'every balance-moving RPC is service_role only'
);

-- The mirror of the above: a grant that is missing everywhere proves nothing.
select ok(
  has_function_privilege('service_role', 'public.redeem_reward(uuid,uuid)', 'execute'),
  'and the service role really does hold the grant'
);

select * from finish();
rollback;
