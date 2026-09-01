-- claim_points is the ONLY write path for a claim, and every money rule in the
-- product lives inside it. Nothing in TypeScript re-implements it any more, so
-- this file is the only place those rules are checked.
--
-- Since 0025 points are computed from MONEY, not from SKUs:
--     base   = floor(order_total / vnd_per_point)
--     points = round/floor/ceil(base * tier_multiplier)
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(11);

-- A single active settings row, so the arithmetic below is predictable
-- regardless of what seed.sql happens to carry.
update public.loyalty_settings set is_active = false;
insert into public.loyalty_settings
  (rounding, claimable_statuses, vnd_per_point, is_active)
values ('floor', '{3,16}', 1000, true);

-- ---------------------------------------------------------------- #1 ----
-- The claim creates the customer, credits the points and books the spend.
-- 500.000đ / 1.000 = 500 base; the member holds no tier yet (Bạc starts at
-- 1.000.000đ under §5.2), so the multiplier falls back to 1.

select lives_ok(
  $$select public.claim_points(
      'ORDER-A', '0911111111', 'Nguyễn Test', null, 'pos-test',
      '[{"sku":"TEST-SKU","qty":2}]'::jsonb, 'claim', 500000)$$,
  'a first claim succeeds'
);

select is(
  (select current_points from public.customers where phone = '0911111111'),
  500,
  '500.000đ at 1.000đ/point, multiplier 1'
);

select is(
  (select lifetime_spend from public.customers where phone = '0911111111'),
  500000::numeric,
  'the order total lands on lifetime_spend'
);

-- The items no longer drive the arithmetic, but they are still the ledger's
-- only per-line audit trail, so they must survive into meta.
select is(
  (select meta -> 'items' -> 0 ->> 'sku'
     from public.transactions where order_code = 'ORDER-A'),
  'TEST-SKU',
  'the item list is still recorded in meta even though it earns nothing'
);

-- The claim is also what writes the link the webhook attributes every later
-- order by. signUp relies on this, which is why linkPancakeCustomer must treat
-- "already set to this value" as success rather than as a failed write.
select is(
  (select pancake_customer_id from public.customers where phone = '0911111111'),
  'pos-test',
  'the claim writes the POS link as a side effect'
);

-- ---------------------------------------------------------------- #2 ----
-- Idempotency. Pancake redelivers, and signup and the webhook can race on the
-- same order; the partial unique index on transactions.order_code is what makes
-- the second one a no-op instead of double points.

select throws_ok(
  $$select public.claim_points(
      'ORDER-A', '0911111111', 'Nguyễn Test', null, 'pos-test',
      '[{"sku":"TEST-SKU","qty":2}]'::jsonb, 'webhook', 500000)$$,
  'P0002',
  null,
  'the same order cannot be claimed twice'
);

select is(
  (select current_points from public.customers where phone = '0911111111'),
  500,
  'the refused duplicate left the balance untouched'
);

-- ---------------------------------------------------------------- #3 ----
-- A refund or a malformed total must never pull a lifetime figure down —
-- lifetime_spend is what the tier ladder and the percentile ranking read.

select lives_ok(
  $$select public.claim_points(
      'ORDER-B', '0911111111', 'Nguyễn Test', null, 'pos-test',
      '[]'::jsonb, 'webhook', -900000)$$,
  'a negative order total is accepted rather than erroring'
);

select is(
  (select lifetime_spend from public.customers where phone = '0911111111'),
  500000::numeric,
  'a negative total contributes nothing instead of subtracting'
);

-- ---------------------------------------------------------------- #4 ----
-- A SKU nobody has ever configured earns exactly the same as any other đồng.
-- This is the whole point of 0025: under the old per-SKU model this order
-- earned ZERO, which is gap G1.

select is(
  (
    select (public.claim_points(
      'ORDER-C', '0922222222', 'Trần Test', null, 'pos-test-2',
      '[{"sku":"NOT-MAPPED","qty":3}]'::jsonb, 'webhook', 2000000
    ) ->> 'points_awarded')::int
  ),
  2000,
  'an unmapped SKU earns on money alone, not zero'
);

-- ---------------------------------------------------------------- #5 ----
-- The đồng -> base division is ALWAYS floor, whatever `rounding` says: a member
-- must never be credited for đồng they did not spend. `rounding` governs only
-- the multiplier step. With rounding = 'ceil', 1.999đ must still be 1 point.

update public.loyalty_settings set rounding = 'ceil' where is_active;

select is(
  (
    select (public.claim_points(
      'ORDER-D', '0933333333', 'Lê Test', null, null,
      '[]'::jsonb, 'claim', 1999
    ) ->> 'points_awarded')::int
  ),
  1,
  'the money division floors even when rounding is ceil'
);

select * from finish();
rollback;
