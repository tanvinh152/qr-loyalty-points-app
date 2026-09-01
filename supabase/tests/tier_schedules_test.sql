-- Scheduled threshold raises (0010) — and the grandfathering guarantee, which
-- is the one promise the shop makes to members in writing: "Members who already
-- reached the tier keep it."
--
-- That guarantee is not implemented by any code. It is implemented by an
-- ABSENCE: apply_due_tier_schedules never touches public.customers, so a raise
-- moves the bar for everyone still climbing and nobody who already arrived.
-- An absence cannot be read off a diff, which is why it is asserted here.
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(17);

-- `a` holds Vàng on 2.000.000đ of spend — comfortably under the raise below, so
-- if the cron ever demoted anyone it would demote them.
insert into public.customers (id, phone, lifetime_spend, tier_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '0916000001', 2000000,
   (select id from public.membership_tiers where name = 'Vàng')),
  ('aaaaaaaa-0000-4000-8000-000000000002', '0916000002', 1000000, null),
  ('aaaaaaaa-0000-4000-8000-000000000003', '0916000003', 5000000, null),
  ('aaaaaaaa-0000-4000-8000-000000000004', '0916000004', 9000000, null),
  -- Never spent anything. Excluded from the ranking population on purpose.
  ('aaaaaaaa-0000-4000-8000-000000000005', '0916000005', 0, null);

-- ---------------------------------------------------------------- #1 ----
-- A due amount schedule raises its tier, and records what it resolved to.

insert into public.tier_threshold_schedules (id, tier_id, mode, target_amount, effective_at)
values ('dddddddd-0000-4000-8000-000000000001',
        (select id from public.membership_tiers where name = 'Vàng'),
        'amount', 2500000, now() - interval '1 hour');

select lives_ok(
  $$select public.apply_due_tier_schedules()$$,
  'a due schedule applies'
);

select is(
  (select spend_threshold from public.membership_tiers where name = 'Vàng'),
  2500000::numeric,
  'the tier threshold was raised to the target'
);

select is(
  (select (applied_at is not null) || '/' || resolved_amount
     from public.tier_threshold_schedules
    where id = 'dddddddd-0000-4000-8000-000000000001'),
  'true/2500000',
  'the schedule is stamped applied with the amount it resolved to'
);

-- ---------------------------------------------------------------- #2 ----
-- THE GRANDFATHERING ASSERTION. `a` now sits below the bar they hold.

select is(
  (select t.name from public.customers c
     join public.membership_tiers t on t.id = c.tier_id
    where c.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Vàng',
  'a member who already reached the tier keeps it after the raise'
);

-- Scoped to the fixture, not a global count: this database is shared with the
-- Playwright suite, which grants tiers by hand and leaves rows behind. A global
-- count would pass or fail depending on what ran before it.
select is(
  (select count(*)::int from public.customer_tier_history
    where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0,
  'the cron writes no tier history: it never touches customers at all'
);

-- ---------------------------------------------------------------- #3 ----
-- Idempotence. The cron route and the /admin/tiers render both call this, so a
-- second call must find nothing left to do.

select is(
  (select public.apply_due_tier_schedules() ->> 'applied'),
  '[]',
  'a second call applies nothing'
);

select is(
  (select spend_threshold from public.membership_tiers where name = 'Vàng'),
  2500000::numeric,
  'and moved the threshold no further'
);

-- ---------------------------------------------------------------- #4 ----
-- A schedule dated in the future is not due yet.

insert into public.tier_threshold_schedules (id, tier_id, mode, target_amount, effective_at)
values ('dddddddd-0000-4000-8000-000000000002',
        (select id from public.membership_tiers where name = 'Bạch kim'),
        'amount', 99000000, now() + interval '30 days');

select lives_ok($$select public.apply_due_tier_schedules()$$, 'a future schedule is skipped');

select is(
  (select applied_at from public.tier_threshold_schedules
    where id = 'dddddddd-0000-4000-8000-000000000002'),
  null,
  'and is left pending rather than applied early'
);

delete from public.tier_threshold_schedules
 where id = 'dddddddd-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------- #5 ----
-- Thresholds only ever go UP. A schedule that is not an increase is marked
-- applied WITH A NOTE rather than left queued — leaving it pending would make
-- it re-fire on every tick, forever.

insert into public.tier_threshold_schedules (id, tier_id, mode, target_amount, effective_at)
values ('dddddddd-0000-4000-8000-000000000003',
        (select id from public.membership_tiers where name = 'Vàng'),
        'amount', 2100000, now() - interval '1 hour');

select lives_ok($$select public.apply_due_tier_schedules()$$, 'a lowering schedule is processed');

select alike(
  (select note from public.tier_threshold_schedules
    where id = 'dddddddd-0000-4000-8000-000000000003'),
  '%[skipped: not an increase]%',
  'a lowering schedule is retired with a note, not left to re-fire forever'
);

select is(
  (select spend_threshold from public.membership_tiers where name = 'Vàng'),
  2500000::numeric,
  'and the threshold did not move down'
);

-- ---------------------------------------------------------------- #6 ----
-- The ladder stays strictly ascending: a raise is bounded by its neighbours,
-- not only by its own current value.

insert into public.tier_threshold_schedules (id, tier_id, mode, target_amount, effective_at)
values ('dddddddd-0000-4000-8000-000000000004',
        (select id from public.membership_tiers where name = 'Vàng'),
        'amount',
        (select spend_threshold from public.membership_tiers where name = 'Bạch kim'),
        now() - interval '1 hour');

select lives_ok($$select public.apply_due_tier_schedules()$$, 'an overlapping raise is processed');

select alike(
  (select note from public.tier_threshold_schedules
    where id = 'dddddddd-0000-4000-8000-000000000004'),
  '%would reach the tier above it%',
  'a raise that would collide with the tier above is refused by name'
);

-- ---------------------------------------------------------------- #7 ----
-- The percentile ranking. Asserted by its PROPERTIES rather than by a hardcoded
-- figure: what matters is that the answer is discrete (a number a real member
-- actually spent, not an interpolation between two of them) and that the
-- population excludes members who have never spent — including them would drag
-- every percentile towards zero and quietly make "top 5%" mean something else.

select ok(
  public.tier_percentile_amount(50) in (
    select lifetime_spend from public.customers where lifetime_spend > 0
  ),
  'percentile_disc returns a figure a real member actually spent'
);

-- percentile_disc(1 - 100/100) = the smallest value in the population. If a
-- 0đ member were counted, "top 100%" would answer 0 instead of 1.000.000.
select is(
  public.tier_percentile_amount(100),
  1000000::numeric,
  'members who never spent are not part of the population being ranked'
);

-- The coalesce floor. A brand new shop has nobody to rank, and the schedule
-- form must get a number rather than a null it would render as "NaN đ".
update public.customers set lifetime_spend = 0;

select is(
  public.tier_percentile_amount(5),
  0::numeric,
  'a shop where nobody has spent yet answers 0, not null'
);

select * from finish();
rollback;
