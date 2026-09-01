-- The spend-milestone ladder (0024), where the guarantees are structural.
--
-- Two things here can only be proved at this level. First, that the DATABASE
-- and not the app is what stops a double claim: the app's button disables
-- itself, but a retried request or a second tab reaches the RPC anyway, and
-- the unique index is what makes the second one fail. Second, that a milestone
-- cannot be spent, won or featured — the three kinds of gift share a table, so
-- the constraints are all that keep them from leaking into each other.
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(18);

-- Fixtures. `mv` is the rung under test; `mv_hi` sits far up the ladder.
-- The thresholds deliberately avoid every value in seed.sql:
-- `rewards_milestone_threshold_idx` is global, so a fixture landing on a seeded
-- rung fails at INSERT and takes the whole file down before test #1 runs.
insert into public.customers (id, phone, lifetime_spend)
values
  ('11111111-1111-1111-1111-111111111111', '0911000001', 1000000),
  ('11111111-1111-1111-1111-111111111112', '0911000002', 0);

insert into public.rewards (id, kind, name, points_cost, quantity, spend_threshold)
values
  ('22222222-2222-2222-2222-222222222221', 'milestone', 'Rung 450k', 0, 0, 450000),
  ('22222222-2222-2222-2222-222222222222', 'milestone', 'Rung 9tr',  0, 0, 9000000);

insert into public.rewards (id, kind, name, points_cost, quantity)
values ('22222222-2222-2222-2222-222222222223', 'redeem', 'Shop item', 100, 5);

-- ---------------------------------------------------------------- #1 ----
-- Claiming twice must fail on the INDEX, not on an app-side guard. This is the
-- assertion the whole design leans on: the RPC takes a row lock and then lets
-- the unique violation be the answer.

select lives_ok(
  $$select public.claim_milestone_reward(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222221')$$,
  'a member past the rung can claim it'
);

select throws_ok(
  $$select public.claim_milestone_reward(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222221')$$,
  'P0003',
  null,
  'the same rung cannot be claimed twice'
);

select is(
  (select count(*)::int from public.milestone_awards
    where customer_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'and only one award row exists after the retry'
);

-- ---------------------------------------------------------------- #2 ----
-- Frozen copies, not a join: renaming the rung must not rewrite the claim.

update public.rewards set name = 'Renamed'
 where id = '22222222-2222-2222-2222-222222222221';

select is(
  (select milestone_name from public.milestone_awards
    where customer_id = '11111111-1111-1111-1111-111111111111'),
  'Rung 450k',
  'the award keeps the name it was claimed under'
);

select is(
  (select threshold_amount from public.milestone_awards
    where customer_id = '11111111-1111-1111-1111-111111111111'),
  450000::numeric,
  'and the threshold it was claimed at'
);

-- ---------------------------------------------------------------- #3 ----
-- Eligibility is the RPC's to decide, and it compares against lifetime_spend.

select throws_ok(
  $$select public.claim_milestone_reward(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222')$$,
  'P0006',
  null,
  'a rung above the member''s spend is locked'
);

select throws_ok(
  $$select public.claim_milestone_reward(
      '11111111-1111-1111-1111-111111111112',
      '22222222-2222-2222-2222-222222222221')$$,
  'P0006',
  null,
  'a member who has spent nothing reaches no rung'
);

-- ---------------------------------------------------------------- #4 ----
-- The kind clause: a shop reward's id must read as "no such milestone", not
-- hand over merchandise. The mirror of the clause redeem_reward gained in 0022.

select throws_ok(
  $$select public.claim_milestone_reward(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222223')$$,
  'P0001',
  null,
  'a shop reward id is not a milestone'
);

select throws_ok(
  $$select public.redeem_reward(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222221')$$,
  'P0001',
  null,
  'and a milestone id is not merchandise'
);

-- ---------------------------------------------------------------- #5 ----
-- A milestone must not squat on the shop's columns or the wheel's. Each of
-- these is a way a rung could otherwise show up in a storefront or a draw.

select throws_ok(
  $$insert into public.rewards (kind, name, points_cost, quantity, spend_threshold)
    values ('milestone', 'Priced', 500, 0, 500000)$$,
  '23514',
  null,
  'a milestone cannot carry a points price'
);

select throws_ok(
  $$insert into public.rewards (kind, name, points_cost, quantity, weight, spend_threshold)
    values ('milestone', 'Weighted', 0, 0, 5, 500000)$$,
  '23514',
  null,
  'a milestone cannot carry a wheel weight'
);

select throws_ok(
  $$insert into public.rewards (kind, name, points_cost, quantity, is_featured, spend_threshold)
    values ('milestone', 'Featured', 0, 0, true, 500000)$$,
  '23514',
  null,
  'a milestone cannot take the shop''s featured slot'
);

-- ---------------------------------------------------------------- #6 ----
-- The threshold column belongs to exactly one kind, in BOTH directions.

select throws_ok(
  $$insert into public.rewards (kind, name, points_cost, quantity, spend_threshold)
    values ('redeem', 'Shop with a rung', 100, 1, 500000)$$,
  '23514',
  null,
  'a shop reward cannot carry a spend threshold'
);

select throws_ok(
  $$insert into public.rewards (kind, name, points_cost, quantity)
    values ('milestone', 'Rungless', 0, 0)$$,
  '23514',
  null,
  'a milestone without a threshold is refused'
);

-- ---------------------------------------------------------------- #7 ----
-- One ACTIVE rung per threshold — but an inactive one may sit alongside it, so
-- a rung can be replaced without first deleting the old one.

select throws_ok(
  $$insert into public.rewards (kind, name, points_cost, quantity, spend_threshold)
    values ('milestone', 'Duplicate', 0, 0, 450000)$$,
  '23505',
  null,
  'two active rungs cannot share a threshold'
);

select lives_ok(
  $$insert into public.rewards (kind, name, points_cost, quantity, is_active, spend_threshold)
    values ('milestone', 'Retired', 0, 0, false, 450000)$$,
  'an inactive rung may share a threshold with an active one'
);

-- ---------------------------------------------------------------- #17 ----
-- An award is NEVER retracted. A refund can drag lifetime_spend back below the
-- rung a member already claimed, and the award still stands — the same sticky
-- posture as customers.tier_id. Nothing in the app deletes these rows; this is
-- what would catch a "tidy up unearned awards" job that ever did.

update public.customers set lifetime_spend = 0
 where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*)::int from public.milestone_awards
    where customer_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'an award survives the spend that earned it being refunded away'
);

-- ---------------------------------------------------------------- #18 ----
-- The RPC trusts the customer id it is handed, which is safe only because the
-- session-proving action is the only thing that can call it.

select ok(
  not has_function_privilege(
    'authenticated', 'public.claim_milestone_reward(uuid,uuid)', 'execute')
    and not has_function_privilege(
      'anon', 'public.claim_milestone_reward(uuid,uuid)', 'execute')
    and has_function_privilege(
      'service_role', 'public.claim_milestone_reward(uuid,uuid)', 'execute'),
  'only service_role may claim a milestone'
);

select * from finish();
rollback;
