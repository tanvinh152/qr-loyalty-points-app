-- 0023 — Realign the tier ladder to the client specification.
--
-- WHY THIS EXISTS
-- The ladder in 0010 (and repeated in seed.sql) was a placeholder, and the live
-- database drifted further from it: Vàng was raised 3M → 5M → 6M through the
-- admin schedule UI. docs/Tich_Diem_ChiCha.md §5.2 states the real
-- programme, and this migration is the ONE-TIME correction that brings the
-- database, seed.sql and the spec onto the same numbers.
--
--   Tier       live before      seed.sql before   §8.2 (this migration)
--   Bạc          0đ  1.0x         0đ  1.0x          1.000.000đ  1.0x
--   Vàng         6.000.000  1.2x  3.000.000  1.2x   2.000.000đ  1.1x
--   Bạch kim     8.000.000  1.5x  8.000.000  1.5x   4.000.000đ  1.2x
--   Kim cương   20.000.000  1.8x 20.000.000  1.8x   8.000.000đ  1.4x
--   Ruby        50.000.000  2.0x 50.000.000  2.0x  40.000.000đ  2.0x
--
-- ⚠️ THIS LOWERS FOUR THRESHOLDS AND THREE MULTIPLIERS.
-- 0010 documents the policy that thresholds only ever go UP, and
-- apply_due_tier_schedules() ENFORCES it for scheduled raises ('not an
-- increase'). That enforcement is not bypassed here: this is a direct UPDATE,
-- the same thing an admin can already do by hand in saveTier(). Treat 0023 as a
-- one-off spec correction, NOT as a precedent — the grandfathering design in
-- 0010/0011/0012 still stands, and scheduled changes must still only raise.
--
-- Safe to run more than once: every statement is an idempotent UPDATE keyed by
-- name, and perks/benefits JSON is never touched (admins edit those in /admin).

-- 1. Guard — a schedule queued against the OLD ladder would read as an
--    "increase" against the new one and fire on the next apply_due_tier_
--    schedules() tick, silently undoing this correction. Refuse rather than
--    race it. (At the time of writing both existing rows are already applied.)
do $$
declare
  v_pending int;
begin
  select count(*) into v_pending
    from public.tier_threshold_schedules
   where applied_at is null;

  if v_pending > 0 then
    raise exception
      '0023: % unapplied tier_threshold_schedules row(s) would override this correction. Apply or cancel them first.',
      v_pending;
  end if;
end $$;

-- 2. Park every threshold in a temporary, collision-free range.
--    spend_threshold is UNIQUE, so assigning the new ladder in place is
--    order-dependent: Kim cương wants 8.000.000, which Bạch kim currently
--    holds. Rather than depend on a hand-picked order — this database has
--    already drifted twice, so its starting ladder cannot be assumed — vacate
--    every slot first. sort_order is unique, so the parked values are too.
update public.membership_tiers set spend_threshold = 1000000000 + sort_order;

-- 3. Assign the §8.2 ladder. With every slot vacated, order does not matter.
--
--    Note Bạc moves 0 → 1.000.000: this removes the 0đ floor tier, so under
--    §8.2 a member below 1.000.000đ holds NO tier. The app already handles
--    that — resolveTiers() returns current: null, /dashboard shows `noTier`,
--    /tiers shows an EmptyState, and claim_points falls back to
--    `coalesce(v_multiplier, 1)` so an untiered member still earns at 1.0×.
update public.membership_tiers set spend_threshold =  1000000, multiplier = 1.0 where name = 'Bạc';
update public.membership_tiers set spend_threshold =  2000000, multiplier = 1.1 where name = 'Vàng';
update public.membership_tiers set spend_threshold =  4000000, multiplier = 1.2 where name = 'Bạch kim';
update public.membership_tiers set spend_threshold =  8000000, multiplier = 1.4 where name = 'Kim cương';
update public.membership_tiers set spend_threshold = 40000000, multiplier = 2.0 where name = 'Ruby';

-- 4. Assert the result rather than trusting it: five rows, strictly ascending,
--    exactly the §8.2 numbers.
do $$
declare
  v_actual text;
begin
  select string_agg(spend_threshold::bigint::text, ',' order by spend_threshold)
    into v_actual
    from public.membership_tiers;

  if v_actual is distinct from '1000000,2000000,4000000,8000000,40000000' then
    raise exception
      '0023: ladder is % after the update, expected the §8.2 five. A parked value (100000000x) means a tier name did not match.',
      v_actual;
  end if;
end $$;

-- 5. Raise customers.tier_id to whatever their spend now earns.
--    Lowering four thresholds promotes people the moment this lands, because
--    resolveDisplayTier() computes the earned tier live from lifetime_spend.
--    Without this backfill the UI and the earn rate would disagree:
--    claim_points reads the multiplier from customers.tier_id (0011:88-97), not
--    from spend, so a freshly-promoted member would keep earning at the old
--    rate until their next claim happened to raise the column.
--
--    Only ever RAISES — never demotes — so the sticky-tier rule from 0010 holds.
with earned as (
  select c.id                as customer_id,
         c.lifetime_spend,
         -- the tier this member's spend now earns under the new ladder
         (select t.id
            from public.membership_tiers t
           where t.spend_threshold <= c.lifetime_spend
           order by t.spend_threshold desc
           limit 1)          as won_tier_id,
         -- and the threshold of the one they already hold, if any
         (select t.spend_threshold
            from public.membership_tiers t
           where t.id = c.tier_id) as held_threshold
    from public.customers c
),
-- Only ever RAISES — never demotes — so the sticky-tier rule from 0010 holds.
target as (
  select e.customer_id, e.lifetime_spend, e.won_tier_id,
         t.name as tier_name, t.spend_threshold
    from earned e
    join public.membership_tiers t on t.id = e.won_tier_id
   where t.spend_threshold > coalesce(e.held_threshold, -1)
),
promoted as (
  update public.customers c
     set tier_id = tg.won_tier_id
    from target tg
   where c.id = tg.customer_id
  returning c.id as customer_id
)
-- Leave a trail so /tiers' getLatestTierAward() can explain the promotion.
-- tier_name and threshold_amount are DENORMALISED on purpose (0011): the award
-- must still read correctly after an admin renames or re-prices the tier.
insert into public.customer_tier_history
  (customer_id, tier_id, tier_name, threshold_amount, spend_at_award, source)
select tg.customer_id, tg.won_tier_id, tg.tier_name, tg.spend_threshold,
       tg.lifetime_spend, 'admin'
  from target tg
  join promoted p on p.customer_id = tg.customer_id;
