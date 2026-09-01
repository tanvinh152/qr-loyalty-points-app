-- The wheel (0022). The draw is random, so every assertion below is made
-- DETERMINISTIC by leaving exactly one eligible wedge and zeroing the weight of
-- the rest — what is being tested is which wedges are eligible at all, not which
-- one the roll picks.
--
-- Three of these cases are the three clauses of `isDrawable` in
-- `src/lib/spin.ts`, one each. That function is what the admin screen shows the
-- odds from; if it and this RPC ever disagree, the odds an admin reads are not
-- the odds the server rolls.
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(15);

update public.loyalty_settings set is_active = false;
insert into public.loyalty_settings
  (rounding, claimable_statuses, vnd_per_point, spin_daily_limit, checkin_points, is_active)
values ('floor', '{3,16}', 1000, 1, 0, true);

insert into public.customers (id, phone, current_points, lifetime_points)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '0913000001', 0, 0),
  ('aaaaaaaa-0000-4000-8000-000000000002', '0913000002', 0, 0);

-- Every seeded wedge out of the way, so only what this file inserts can be won.
update public.rewards set weight = 0 where kind = 'spin';

insert into public.rewards
  (id, kind, name, points_cost, quantity, prize_type, points_amount, weight, sort_order)
values
  ('cccccccc-0000-4000-8000-00000000000a', 'spin', 'Điểm',  0, 0, 'points', 1000, 10, 1),
  ('cccccccc-0000-4000-8000-00000000000b', 'spin', 'Quà',   0, 3, 'gift',      0, 10, 2),
  ('cccccccc-0000-4000-8000-00000000000c', 'spin', 'Trượt', 0, 0, 'none',      0, 10, 3);

-- ---------------------------------------------------------------- #1 ----
-- The feature switch. 0 is how an admin turns the wheel off, and the member
-- must be told that rather than shown an error.

update public.rewards set weight = 0
 where id in ('cccccccc-0000-4000-8000-00000000000b',
              'cccccccc-0000-4000-8000-00000000000c');
update public.loyalty_settings set spin_daily_limit = 0 where is_active;

select throws_ok(
  $$select public.spin_wheel('aaaaaaaa-0000-4000-8000-000000000001')$$,
  'P0005',
  null,
  'a daily limit of 0 means the wheel is switched off'
);

update public.loyalty_settings set spin_daily_limit = 1 where is_active;

-- ---------------------------------------------------------------- #2 ----
-- A points wedge is the only kind that moves money, and it moves BOTH balances.

select is(
  (select public.spin_wheel('aaaaaaaa-0000-4000-8000-000000000001')
            ->> 'prize_name'),
  'Điểm',
  'the only weighted wedge is the one that comes up'
);

select is(
  (select current_points || '/' || lifetime_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '1000/1000',
  'a points wedge credits the spendable balance and the lifetime one'
);

select is(
  (select type || '/' || source || '/' || amount from public.transactions
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'EARN/spin/1000',
  'and books exactly one EARN row sourced to the wheel'
);

select is(
  (select count(*)::int from public.spin_results
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and spin_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date),
  1,
  'the spin is counted by a row, not by a counter column'
);

-- ---------------------------------------------------------------- #3 ----
-- The daily limit. The row lock on the customer is what serializes two
-- concurrent spins and therefore what makes this count trustworthy.

select throws_ok(
  $$select public.spin_wheel('aaaaaaaa-0000-4000-8000-000000000001')$$,
  'P0002',
  null,
  'a second spin the same Vietnam day is refused'
);

-- ---------------------------------------------------------------- #4 ----
-- isDrawable clause 3: a sold-out gift leaves the draw entirely, rather than
-- being won forever against stock that is not there.

update public.rewards set weight = 0
 where id = 'cccccccc-0000-4000-8000-00000000000a';
update public.rewards set weight = 10, quantity = 0
 where id = 'cccccccc-0000-4000-8000-00000000000b';

select throws_ok(
  $$select public.spin_wheel('aaaaaaaa-0000-4000-8000-000000000002')$$,
  'P0004',
  null,
  'a sold-out gift is not drawable (isDrawable clause 3)'
);

-- ---------------------------------------------------------------- #5 ----
-- isDrawable clause 2: weight 0 keeps a wedge off the draw. This is how an
-- admin parks a wedge without deleting it.

update public.rewards set quantity = 3
 where id = 'cccccccc-0000-4000-8000-00000000000b';
update public.rewards set weight = 0
 where id = 'cccccccc-0000-4000-8000-00000000000b';
update public.rewards set weight = 0
 where id = 'cccccccc-0000-4000-8000-00000000000c';

select throws_ok(
  $$select public.spin_wheel('aaaaaaaa-0000-4000-8000-000000000002')$$,
  'P0004',
  null,
  'a wedge with no weight is not drawable (isDrawable clause 2)'
);

-- ---------------------------------------------------------------- #6 ----
-- isDrawable clause 1: is_active = false.

update public.rewards set weight = 10, is_active = false
 where id = 'cccccccc-0000-4000-8000-00000000000c';

select throws_ok(
  $$select public.spin_wheel('aaaaaaaa-0000-4000-8000-000000000002')$$,
  'P0004',
  null,
  'a deactivated wedge is not drawable (isDrawable clause 1)'
);

-- ---------------------------------------------------------------- #7 ----
-- A 'none' wedge deliberately leaves NO ledger row: nothing moved, so nothing
-- should appear in the member's history as if it had.

update public.rewards set is_active = true
 where id = 'cccccccc-0000-4000-8000-00000000000c';

select lives_ok(
  $$select public.spin_wheel('aaaaaaaa-0000-4000-8000-000000000002')$$,
  'a losing wedge is a perfectly valid spin'
);

select is(
  (select count(*)::int from public.transactions
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  0,
  'a losing wedge writes no ledger row at all'
);

select is(
  (select current_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  0,
  'and moves no points'
);

-- ---------------------------------------------------------------- #8 ----
-- A gift wedge takes a unit of real stock and books nothing: it is settled by
-- hand at the counter, which is what the header pill's badge dot is for.

update public.loyalty_settings set spin_daily_limit = 5 where is_active;
update public.rewards set weight = 0
 where id = 'cccccccc-0000-4000-8000-00000000000c';
update public.rewards set weight = 10, quantity = 3
 where id = 'cccccccc-0000-4000-8000-00000000000b';

select lives_ok(
  $$select public.spin_wheel('aaaaaaaa-0000-4000-8000-000000000002')$$,
  'a gift wedge can be won'
);

select is(
  (select quantity from public.rewards
    where id = 'cccccccc-0000-4000-8000-00000000000b'),
  2,
  'winning a gift takes exactly one unit of its stock'
);

-- ---------------------------------------------------------------- #9 ----
-- spins_left is what the header pill renders before the next click.

select is(
  ((select public.spin_wheel('aaaaaaaa-0000-4000-8000-000000000001')
             ->> 'spins_left')::int),
  3,
  'spins_left counts down from the daily limit'
);

select * from finish();
rollback;
