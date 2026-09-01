-- Daily check-in (0019). The only rule here that TypeScript cannot express is
-- the DAY BOUNDARY: the check-in is booked against Vietnam's calendar day, not
-- the server's. `todayInVietnam()` in `src/lib/loyalty.ts` computes the same
-- date for the UI, and the two must agree or a member is shown a button that
-- the RPC will refuse.
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(12);

update public.loyalty_settings set is_active = false;
insert into public.loyalty_settings
  (rounding, claimable_statuses, vnd_per_point, checkin_points, spin_daily_limit, is_active)
values ('floor', '{3,16}', 1000, 10, 0, true);

insert into public.customers (id, phone, current_points, lifetime_points)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '0915000001', 0, 0),
  ('aaaaaaaa-0000-4000-8000-000000000002', '0915000002', 0, 0);

-- ---------------------------------------------------------------- #1 ----
-- The feature switch. 0 points is how an admin turns check-in off.

update public.loyalty_settings set checkin_points = 0 where is_active;

select throws_ok(
  $$select public.checkin('aaaaaaaa-0000-4000-8000-000000000001')$$,
  'P0005',
  null,
  'checkin_points = 0 means the feature is off'
);

update public.loyalty_settings set checkin_points = 10 where is_active;

-- ---------------------------------------------------------------- #2 ----
-- The first check-in of the day, and both balances it moves.

select lives_ok(
  $$select public.checkin('aaaaaaaa-0000-4000-8000-000000000001')$$,
  'the first check-in of the day succeeds'
);

select is(
  (select current_points || '/' || lifetime_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '10/10',
  'the award lands on the spendable balance and the lifetime one'
);

select is(
  (select type || '/' || source || '/' || amount from public.transactions
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'EARN/checkin/10',
  'and books exactly one EARN row sourced to the check-in'
);

-- ---------------------------------------------------------------- #3 ----
-- The day boundary. Vietnam is UTC+7, so the VN calendar day is never BEHIND
-- the UTC one — which is exactly the assertion that fails if someone
-- "simplifies" the expression to current_date on a UTC server.

select is(
  (select checkin_date from public.customer_checkins
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  'the row is booked against the Vietnam calendar day'
);

select ok(
  (select checkin_date from public.customer_checkins
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001')
  >= (now() at time zone 'utc')::date,
  'the Vietnam day is never behind the UTC day (UTC+7, no DST)'
);

select is(
  (select meta ->> 'checkin_date' from public.transactions
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  ((now() at time zone 'Asia/Ho_Chi_Minh')::date)::text,
  'and the ledger row carries the same date'
);

-- ---------------------------------------------------------------- #4 ----
-- Idempotency. The unique index is the authority; the RPC only translates its
-- violation into a code the member can be told about.

select throws_ok(
  $$select public.checkin('aaaaaaaa-0000-4000-8000-000000000001')$$,
  'P0002',
  null,
  'a second check-in the same Vietnam day is refused'
);

select is(
  (select count(*)::int from public.customer_checkins
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'the retry left exactly one check-in row'
);

select is(
  (select current_points from public.customers
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  10,
  'and awarded nothing a second time'
);

select is(
  (select count(*)::int from public.transactions
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'and wrote no second ledger row'
);

-- ---------------------------------------------------------------- #5 ----
-- The index is per customer, not global. Obvious, and precisely the kind of
-- thing a hand-written "one check-in per day" guard gets wrong.

select lives_ok(
  $$select public.checkin('aaaaaaaa-0000-4000-8000-000000000002')$$,
  'a different member may still check in the same day'
);

select * from finish();
rollback;
