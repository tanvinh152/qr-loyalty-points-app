-- Manual adjustment (0012). This is the one place staff can move a balance or
-- hand out a tier by hand, and the two invariants it must never break are both
-- invisible from the app: `customers.tier_id` only ever goes UP, and a granted
-- tier moves no `lifetime_spend`.
--
-- That second one matters more than it looks. `tier_percentile_amount` ranks
-- the whole member base by `lifetime_spend`, so inventing spend to justify a
-- gift tier would quietly corrupt every "top N%" schedule the shop ever queues.
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(16);

insert into public.customers
  (id, phone, current_points, lifetime_points, lifetime_spend, tier_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '0914000001', 100, 100, 500000,
   (select id from public.membership_tiers where name = 'Vàng')),
  ('aaaaaaaa-0000-4000-8000-000000000002', '0914000002', 0, 0, 0, null);

-- ---------------------------------------------------------------- #1 ----
-- A reason is not paperwork: the ledger row is the only record of why a balance
-- moved by hand, so a blank one is refused before anything else happens.

select throws_ok(
  $$select public.adjust_points(
      'aaaaaaaa-0000-4000-8000-000000000001', 50, 0, null, '   ', '{}'::jsonb)$$,
  'P0001',
  null,
  'a blank reason is refused before anything moves'
);

select is(
  (select current_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  100,
  'the refused call moved nothing'
);

-- ---------------------------------------------------------------- #2 ----
-- The happy path, and the audit trail it must leave.

select lives_ok(
  $$select public.adjust_points(
      'aaaaaaaa-0000-4000-8000-000000000001', 50, 0, null,
      '  Bù điểm đơn lỗi  ', '{"id":"staff-1","email":"s@shop.test"}'::jsonb)$$,
  'a staff grant of 50 points succeeds'
);

select is(
  (select current_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  150,
  'the balance moved by exactly the delta'
);

select is(
  (select type || '/' || source || '/' || amount from public.transactions
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'ADJUST/admin/50',
  'one ADJUST row records the flow of spendable points'
);

select is(
  (select meta ->> 'reason' from public.transactions
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Bù điểm đơn lỗi',
  'the reason is trimmed before it is stored'
);

select is(
  (select meta -> 'actor' ->> 'email' from public.transactions
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  's@shop.test',
  'the acting staff member is recorded on the row'
);

-- ---------------------------------------------------------------- #3 ----
-- Overdrawing. The RPC reports it by name rather than letting the check
-- constraint on customers surface as a raw 23514 — and writes no ledger row,
-- so the balance and the ledger cannot drift apart.

select throws_ok(
  $$select public.adjust_points(
      'aaaaaaaa-0000-4000-8000-000000000001', -200, 0, null, 'trừ quá tay', '{}'::jsonb)$$,
  'P0003',
  null,
  'an adjustment that would go negative is refused'
);

select is(
  (select count(*)::int from public.transactions
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'the refused overdraw wrote no second ledger row'
);

-- ---------------------------------------------------------------- #4 ----
-- Granting a tier. It is a DECISION, not revenue.

select lives_ok(
  $$select public.adjust_points(
      'aaaaaaaa-0000-4000-8000-000000000001', 0, 0,
      (select id from public.membership_tiers where name = 'Kim cương'),
      'nâng hạng tri ân', '{}'::jsonb)$$,
  'a pure tier grant needs no points delta'
);

select is(
  (select t.name from public.customers c
     join public.membership_tiers t on t.id = c.tier_id
    where c.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Kim cương',
  'the granted tier is held'
);

-- The whole reason lifetime_spend is absent from the UPDATE. Faking spend here
-- would move the shop's percentile ranking for every later schedule.
select is(
  (select lifetime_spend from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  500000::numeric,
  'a granted tier invents no spend'
);

select is(
  (select source from public.customer_tier_history
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'admin',
  'the grant is recorded in the tier history as an admin decision'
);

-- ---------------------------------------------------------------- #5 ----
-- tier_id is STICKY: the highest tier ever held, never lowered. Granting a
-- lower tier is a no-op, and says so by name so the form can explain it.

select throws_ok(
  $$select public.adjust_points(
      'aaaaaaaa-0000-4000-8000-000000000001', 0, 0,
      (select id from public.membership_tiers where name = 'Vàng'),
      'hạ hạng', '{}'::jsonb)$$,
  'P0005',
  null,
  'granting a LOWER tier is refused as a no-op, not applied'
);

select is(
  (select t.name from public.customers c
     join public.membership_tiers t on t.id = c.tier_id
    where c.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Kim cương',
  'and the tier held is unchanged'
);

-- ---------------------------------------------------------------- #6 ----
-- A member who has never held a tier. `v_old_thr is null` is its own branch:
-- without it the comparison would be against NULL and no grant would ever land.

select lives_ok(
  $$select public.adjust_points(
      'aaaaaaaa-0000-4000-8000-000000000002', 0, 0,
      (select id from public.membership_tiers where name = 'Bạc'),
      'hạng đầu tiên', '{}'::jsonb)$$,
  'a member holding no tier can be granted their first one'
);

select * from finish();
rollback;
