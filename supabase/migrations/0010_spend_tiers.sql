-- Tiers move from POINTS to SPEND.
--
-- Until now a customer's tier was derived from `lifetime_points`, which is a
-- function of the `product_points` map: two customers who spent the same money
-- could land in different tiers just because one bought a better-mapped SKU.
-- Points stay exactly as they are — they are what a reward costs — but the tier
-- ladder is now measured in đồng.
--
-- Two properties this migration establishes and everything downstream relies on:
--
--   1. `customers.tier_id` is the HIGHEST TIER EVER HELD, not the tier the
--      current spend earns. Raising a threshold must never demote anybody, so
--      nothing here (and nothing in apply_due_tier_schedules below) ever writes
--      `customers.tier_id`.
--   2. Thresholds only ever go UP. `tier_threshold_schedules` is the one way to
--      move one, it is applied by a service-role RPC, and the RPC refuses any
--      change that would break the ascending ladder.
--
-- Existing customers start at `lifetime_spend = 0` — Pancake masks phone numbers
-- so their order history cannot be backfilled. They keep the tier they already
-- hold through property (1).

-- ---- customers.lifetime_spend ----
-- numeric(14,0): đồng are whole units and the amounts outgrow int4 quickly
-- (10 million VND fits in int4, a wholesale buyer's lifetime total does not).
alter table public.customers
  add column if not exists lifetime_spend numeric(14,0) not null default 0
    check (lifetime_spend >= 0);

-- ---- membership_tiers.threshold -> spend_threshold ----
-- Guarded so a re-run (or a fresh `db reset`, where 0001 already created the old
-- name) cannot fail on the rename. The unique + check constraints follow the
-- column through the rename; only the type changes.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'membership_tiers'
       and column_name = 'threshold'
  ) then
    alter table public.membership_tiers rename column threshold to spend_threshold;
  end if;
end
$$;

alter table public.membership_tiers
  alter column spend_threshold type numeric(14,0);

comment on column public.membership_tiers.spend_threshold is
  'Lifetime spend in đồng required to reach this tier. Measured against customers.lifetime_spend, never against points.';

-- ---- the five-tier ladder ----
-- The old set was four point-based tiers headed by "Thành viên" at 0 points.
-- "Bạc" takes over the 0đ entry tier, so the old row is removed rather than
-- renamed. With Bạc sitting at 0đ everyone lands back in a tier immediately.
--
-- `customers.tier_id` is `on delete restrict`, so the holders are detached here
-- explicitly rather than by cascade. That is the point of restrict: dropping a
-- tier is a demotion, and a demotion has to be written down, not inferred.
--
-- Order matters: the delete frees threshold 0 before Bạc is lowered onto it,
-- otherwise the unique constraint fires mid-statement.
update public.customers
   set tier_id = null
 where tier_id in (select id from public.membership_tiers where name = 'Thành viên');

delete from public.membership_tiers where name = 'Thành viên';

-- Amounts are a starting point; admins edit them (and schedule raises) from
-- /admin/tiers. Perks are only written on INSERT so a re-run cannot clobber
-- whatever the shop has since edited.
insert into public.membership_tiers (name, spend_threshold, multiplier, sort_order, benefits, perks) values
  ('Bạc',       0,        1.0, 1, 'Tích điểm mọi đơn hàng', '[
     {"icon":"percent","title":"Tích điểm mọi đơn","detail":"Áp dụng cho toàn bộ sản phẩm"}
   ]'::jsonb),
  ('Vàng',      3000000,  1.2, 2, 'Nhân 1.2 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.2×","detail":"Trên mọi đơn hàng"},
     {"icon":"gift","title":"Quà chào hạng","detail":"Voucher khi lên hạng Vàng"}
   ]'::jsonb),
  ('Bạch kim',  8000000,  1.5, 3, 'Nhân 1.5 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.5×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"3 mã mỗi tháng"}
   ]'::jsonb),
  ('Kim cương', 20000000, 1.8, 4, 'Nhân 1.8 điểm + quà sinh nhật', '[
     {"icon":"percent","title":"Tích điểm 1.8×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"Không giới hạn"},
     {"icon":"cake","title":"Quà sinh nhật","detail":"Voucher 10% + quà tặng"}
   ]'::jsonb),
  ('Ruby',      50000000, 2.0, 5, 'Nhân 2 điểm + đặc quyền cao nhất', '[
     {"icon":"percent","title":"Tích điểm 2×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"Không giới hạn"},
     {"icon":"cake","title":"Quà sinh nhật","detail":"Quà cao cấp cho bé cưng"},
     {"icon":"award","title":"Ưu tiên hỗ trợ","detail":"Đường dây riêng 24/7"}
   ]'::jsonb)
on conflict (name) do update
  set spend_threshold = excluded.spend_threshold,
      multiplier      = excluded.multiplier,
      sort_order      = excluded.sort_order;

-- ---- scheduled threshold raises ----
--
-- Release one sets thresholds by hand. Once the member base is big enough the
-- shop wants to raise the bar on a date it picks, and to express the new bar
-- either as an amount or as a slice of the population ("Ruby = top 5% of
-- spenders"). A percentile is meaningless as a stored rule — it would silently
-- re-rank people every time someone new registers — so it is RESOLVED to a đồng
-- amount at the moment it applies and is a fixed number from then on.
create table if not exists public.tier_threshold_schedules (
  id                uuid primary key default gen_random_uuid(),
  tier_id           uuid not null references public.membership_tiers(id) on delete cascade,
  mode              text not null check (mode in ('amount','percentile')),
  target_amount     numeric(14,0),          -- mode = 'amount'
  target_percentile numeric(5,2),           -- mode = 'percentile': the top N% by lifetime_spend
  -- Written when the schedule fires. For a percentile this is the whole point of
  -- the table: it is the audit trail of what "top 5%" meant that day.
  resolved_amount   numeric(14,0),
  effective_at      timestamptz not null,
  applied_at        timestamptz,
  note              text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  -- Strictly positive: 0đ is not a threshold, it is every member at once. This
  -- is the backstop for a blank form field that coerced to 0 on the way in.
  check ((mode = 'amount'     and target_amount     is not null and target_amount > 0)
      or (mode = 'percentile' and target_percentile is not null
          and target_percentile > 0 and target_percentile < 100))
);

-- One pending schedule per tier: two queued raises for the same tier would apply
-- in an order nobody chose.
create unique index if not exists tier_schedule_one_pending
  on public.tier_threshold_schedules (tier_id) where applied_at is null;

create index if not exists tier_schedule_due_idx
  on public.tier_threshold_schedules (effective_at) where applied_at is null;

-- ---- tier award history ----
--
-- Why a member holds a tier the current thresholds say they have not earned.
-- Both the customer's own /tiers screen and support need to be able to answer
-- that, and `customers.tier_id` alone cannot — it carries no date and no record
-- of the threshold that was in force.
create table if not exists public.customer_tier_history (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers(id) on delete cascade,
  tier_id          uuid references public.membership_tiers(id) on delete set null,
  -- Snapshots, not joins: the tier may be renamed or its threshold raised, and
  -- this row has to keep saying what was true on the day it was written.
  tier_name        text not null,
  threshold_amount numeric(14,0) not null,
  spend_at_award   numeric(14,0) not null,
  source           text not null check (source in ('claim','webhook','admin')),
  awarded_at       timestamptz not null default now()
);

create index if not exists customer_tier_history_customer_idx
  on public.customer_tier_history (customer_id, awarded_at desc);

-- ---- RLS ----
-- Same posture as 0002/0005: nobody writes these directly, only the
-- SECURITY DEFINER RPCs below and the admin server actions do.
alter table public.tier_threshold_schedules enable row level security;
alter table public.customer_tier_history    enable row level security;

drop policy if exists "admin manage tier schedules" on public.tier_threshold_schedules;
create policy "admin manage tier schedules"
  on public.tier_threshold_schedules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read own tier history" on public.customer_tier_history;
create policy "read own tier history"
  on public.customer_tier_history for select to authenticated
  using (
    public.is_admin()
    or customer_id in (
      select c.id from public.customers c where c.auth_user_id = auth.uid()
    )
  );

-- ---- percentile -> đồng ----
--
-- "Top P% of spenders" is the value at the (100 - P)th percentile of
-- lifetime_spend. percentile_disc (not _cont) so the answer is always a real
-- customer's number rather than an interpolated one. Customers with no spend at
-- all are excluded: they are not part of the population the shop is ranking, and
-- including them would drag every percentile towards zero.
create or replace function public.tier_percentile_amount(p_percentile numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    percentile_disc(1 - least(greatest(coalesce(p_percentile, 0), 0), 100) / 100)
      within group (order by lifetime_spend),
    0)
    from public.customers
   where lifetime_spend > 0;
$$;

revoke all on function public.tier_percentile_amount(numeric)
  from public, anon, authenticated;
grant execute on function public.tier_percentile_amount(numeric) to service_role;

-- ---- apply due schedules ----
--
-- Idempotent and safe to call from anywhere: `applied_at is null` plus
-- `for update skip locked` means a cron tick racing an admin page load cannot
-- apply the same raise twice.
--
-- A schedule that would break the ladder is NOT left pending — it is marked
-- applied with a note saying why it did nothing. Leaving it queued would make it
-- fire again on every tick forever.
--
-- Deliberately does not touch public.customers: leaving `tier_id` alone IS the
-- grandfathering mechanism.
create or replace function public.apply_due_tier_schedules()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row       public.tier_threshold_schedules;
  v_amount    numeric;
  v_current   numeric;
  v_sort      integer;
  v_name      text;
  v_prev_max  numeric;
  v_next_min  numeric;
  v_skip      text;
  v_applied   jsonb := '[]'::jsonb;
begin
  for v_row in
    select * from public.tier_threshold_schedules
     where applied_at is null and effective_at <= now()
     order by effective_at
     for update skip locked
  loop
    select t.spend_threshold, t.sort_order, t.name
      into v_current, v_sort, v_name
      from public.membership_tiers t
     where t.id = v_row.tier_id;

    v_amount := round(coalesce(
      case v_row.mode
        when 'amount' then v_row.target_amount
        else public.tier_percentile_amount(v_row.target_percentile)
      end, 0));

    -- The ladder must stay strictly ascending by sort_order, so a raise is
    -- bounded by its neighbours as well as by its own current value.
    select max(t.spend_threshold) into v_prev_max
      from public.membership_tiers t where t.sort_order < v_sort;
    select min(t.spend_threshold) into v_next_min
      from public.membership_tiers t where t.sort_order > v_sort;

    v_skip := case
      when v_current is null then 'tier no longer exists'
      when v_amount <= v_current then 'not an increase'
      when v_prev_max is not null and v_amount <= v_prev_max then 'would fall to or below the tier beneath it'
      when v_next_min is not null and v_amount >= v_next_min then 'would reach the tier above it'
    end;

    if v_skip is not null then
      update public.tier_threshold_schedules
         set applied_at      = now(),
             resolved_amount = v_amount,
             note            = trim(coalesce(note || ' ', '') || '[skipped: ' || v_skip || ']')
       where id = v_row.id;
      continue;
    end if;

    update public.membership_tiers
       set spend_threshold = v_amount
     where id = v_row.tier_id;

    update public.tier_threshold_schedules
       set applied_at = now(), resolved_amount = v_amount
     where id = v_row.id;

    v_applied := v_applied || jsonb_build_object(
      'schedule_id', v_row.id,
      'tier_id',     v_row.tier_id,
      'tier_name',   v_name,
      'from',        v_current,
      'to',          v_amount);
  end loop;

  return json_build_object('applied', v_applied);
end;
$$;

revoke all on function public.apply_due_tier_schedules()
  from public, anon, authenticated;
grant execute on function public.apply_due_tier_schedules() to service_role;
