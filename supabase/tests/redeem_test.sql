-- Redemption is the only place a member spends points, and there is no refund
-- path anywhere in this app — so every guard below is the last one. All of them
-- live inside redeem_reward (latest body: 0022_spin_wheel.sql), under a row lock
-- that TypeScript cannot hold, which is why they can only be pinned here.
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(16);

-- Fixtures. `a` can afford the voucher and holds Vàng; `b` holds no tier at all,
-- which is the case the coalesce(..., -1) floor exists for.
insert into public.customers (id, phone, current_points, lifetime_points, tier_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '0912000001', 600, 600,
   (select id from public.membership_tiers where name = 'Vàng')),
  ('aaaaaaaa-0000-4000-8000-000000000002', '0912000002', 600, 600, null);

insert into public.rewards (id, kind, name, points_cost, quantity, min_tier_id)
values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'redeem', 'Voucher', 500, 1, null),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'redeem', 'Gated',     0, 5,
   (select id from public.membership_tiers where name = 'Kim cương')),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'redeem', 'Retired', 100, 5, null);

update public.rewards set is_active = false
 where id = 'bbbbbbbb-0000-4000-8000-000000000003';

-- A wheel wedge. All three kinds of gift share this table, so the shop query
-- has to pin kind = 'redeem' or a wedge becomes buyable.
insert into public.rewards (id, kind, name, points_cost, quantity, prize_type, weight)
values ('bbbbbbbb-0000-4000-8000-000000000009', 'spin', 'Wedge', 0, 5, 'none', 10);

-- ---------------------------------------------------------------- #1 ----
-- The happy path, and what it must and must not move.

select lives_ok(
  $$select public.redeem_reward(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000001')$$,
  'a member holding enough points redeems the voucher'
);

select is(
  (select current_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  100,
  'the balance is debited by exactly points_cost'
);

-- lifetime_points is what the member has EVER earned. Spending must not touch
-- it, or redeeming would eventually cost someone their standing.
select is(
  (select lifetime_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  600,
  'spending points never lowers lifetime_points'
);

select is(
  (select quantity from public.rewards
    where id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0,
  'the stock is decremented by one'
);

select is(
  (select amount from public.transactions
    where reward_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  -500,
  'the ledger records the spend as a negative amount'
);

select is(
  (select type || '/' || source from public.transactions
    where reward_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'REDEEM/redeem',
  'the row is typed and sourced as a redemption'
);

-- The name is a frozen copy, not a join. Renaming a gift must never rewrite
-- what a member already took — the same rule milestone_awards follows.
update public.rewards set name = 'Voucher (đổi tên)'
 where id = 'bbbbbbbb-0000-4000-8000-000000000001';

select is(
  (select meta ->> 'reward_name' from public.transactions
    where reward_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'Voucher',
  'the ledger keeps the name the reward was redeemed under'
);

-- ---------------------------------------------------------------- #2 ----
-- Out of stock. The stock check and the decrement are one indivisible step
-- under the row lock, so the last unit cannot be handed out twice.

select throws_ok(
  $$select public.redeem_reward(
      'aaaaaaaa-0000-4000-8000-000000000002',
      'bbbbbbbb-0000-4000-8000-000000000001')$$,
  'P0002',
  null,
  'a sold-out reward cannot be redeemed'
);

select is(
  (select current_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  600,
  'the refused redemption left the balance untouched'
);

-- ---------------------------------------------------------------- #3 ----
-- Not enough points, and no stock leaks on the way out.

update public.customers set current_points = 100
 where id = 'aaaaaaaa-0000-4000-8000-000000000002';
update public.rewards set quantity = 5
 where id = 'bbbbbbbb-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.redeem_reward(
      'aaaaaaaa-0000-4000-8000-000000000002',
      'bbbbbbbb-0000-4000-8000-000000000001')$$,
  'P0003',
  null,
  'a member short of the price is refused'
);

select is(
  (select quantity from public.rewards
    where id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  5,
  'the refused redemption did not consume a unit'
);

-- ---------------------------------------------------------------- #4 ----
-- One catalog, three kinds. A wedge and a deactivated item both have to read as
-- "no such reward" — the storefront must not become a way to take either.

select throws_ok(
  $$select public.redeem_reward(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000003')$$,
  'P0001',
  null,
  'a deactivated reward reads as no such reward'
);

select throws_ok(
  $$select public.redeem_reward(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000009')$$,
  'P0001',
  null,
  'a wheel wedge is not merchandise'
);

-- ---------------------------------------------------------------- #5 ----
-- The tier gate (0017). Compared on spend_threshold, and inclusive: holding
-- exactly the required tier is enough.

select throws_ok(
  $$select public.redeem_reward(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000002')$$,
  'P0006',
  null,
  'a Vàng member cannot take a Kim cương reward'
);

-- A NULL tier_id floors below every gate, including the 0đ one. Nobody who can
-- afford a reward should have one, but the coalesce is what makes that safe.
select throws_ok(
  $$select public.redeem_reward(
      'aaaaaaaa-0000-4000-8000-000000000002',
      'bbbbbbbb-0000-4000-8000-000000000002')$$,
  'P0006',
  null,
  'a member holding no tier at all falls below every gate'
);

update public.customers
   set tier_id = (select id from public.membership_tiers where name = 'Kim cương')
 where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select lives_ok(
  $$select public.redeem_reward(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000002')$$,
  'the gate is >= : holding exactly the required tier passes'
);

select * from finish();
rollback;
