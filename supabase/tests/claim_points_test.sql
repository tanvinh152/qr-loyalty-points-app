-- claim_points is the ONLY write path for a claim, and every money rule in the
-- product lives inside it. Nothing in TypeScript re-implements it any more, so
-- this file is the only place those rules are checked.
--
-- Run with: npm run test:db  (Supabase CLI + Docker required)

begin;
select plan(9);

-- A single active settings row and one known SKU, so the arithmetic below is
-- predictable regardless of what seed.sql happens to carry.
update public.loyalty_settings set is_active = false;
insert into public.loyalty_settings
  (rounding, claimable_statuses, unmapped_sku_points, is_active)
values ('floor', '{3,16}', 0, true);

insert into public.product_points (product_code, label, points_awarded, is_active)
values ('TEST-SKU', 'Test item', 10, true)
on conflict (product_code) do update
  set points_awarded = 10, is_active = true;

-- ---------------------------------------------------------------- #1 ----
-- The claim creates the customer, credits the points and books the spend.

select lives_ok(
  $$select public.claim_points(
      'ORDER-A', '0911111111', 'Nguyễn Test', null, 'pos-test',
      '[{"sku":"TEST-SKU","qty":2}]'::jsonb, 'claim', 500000)$$,
  'a first claim succeeds'
);

select is(
  (select current_points from public.customers where phone = '0911111111'),
  20,
  '2 x TEST-SKU at 10 points, multiplier 1'
);

select is(
  (select lifetime_spend from public.customers where phone = '0911111111'),
  500000::numeric,
  'the order total lands on lifetime_spend'
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
  20,
  'the refused duplicate left the balance untouched'
);

-- ---------------------------------------------------------------- #3 ----
-- A refund or a malformed total must never pull a lifetime figure down —
-- lifetime_spend is what the tier ladder and the percentile ranking read.

select lives_ok(
  $$select public.claim_points(
      'ORDER-B', '0911111111', 'Nguyễn Test', null, 'pos-test',
      '[{"sku":"TEST-SKU","qty":1}]'::jsonb, 'webhook', -900000)$$,
  'a negative order total is accepted rather than erroring'
);

select is(
  (select lifetime_spend from public.customers where phone = '0911111111'),
  500000::numeric,
  'a negative total contributes nothing instead of subtracting'
);

-- ---------------------------------------------------------------- #4 ----
-- An unmapped SKU falls back to the configured default rather than being
-- skipped, so a shop that has not mapped anything still awards something once
-- unmapped_sku_points is raised.

update public.loyalty_settings set unmapped_sku_points = 5 where is_active;

select is(
  (
    select (public.claim_points(
      'ORDER-C', '0922222222', 'Trần Test', null, 'pos-test-2',
      '[{"sku":"NOT-MAPPED","qty":3}]'::jsonb, 'webhook', 100000
    ) ->> 'points_awarded')::int
  ),
  15,
  'an unknown SKU earns the configured fallback, not zero'
);

select * from finish();
rollback;
