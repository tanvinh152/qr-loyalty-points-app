-- claim_points v4: points are MONEY, not SKUs.
--
-- §5.1 of docs/Tich_Diem_ChiCha.md states the programme in one line:
-- `1.000 VNĐ chi tiêu thực = 1 điểm`. Until now points came from a hand-curated
-- SKU -> points map (public.product_points, 0001), which meant an unmapped SKU
-- earned `loyalty_settings.unmapped_sku_points` — seeded to 0. A member could
-- spend 2.000.000đ on a product nobody had mapped and earn NOTHING, and two
-- members who spent the same money earned differently. That is the gap G1 in
-- docs/gap-analysis-vs-client-spec.md.
--
-- New formula, the ONLY implementation of it (0011's rule still stands — do not
-- reintroduce a TypeScript copy):
--
--     base   = floor(money_actually_paid / vnd_per_point)
--     points = round/floor/ceil(base * tier_multiplier)
--
-- The division to base points is ALWAYS floor and is deliberately NOT governed
-- by `rounding`: a member must never be credited for đồng they did not spend.
-- `rounding` survives because it still governs the MULTIPLIER step, where the
-- §5.2 ladder (1.1×, 1.2×, 1.4×) guarantees fractions. Do not "fix" the
-- asymmetry — it is the point.
--
-- The money is `p_order_total`, i.e. orderSpendTotal() in
-- src/lib/pancake/client.ts, which reads `total_price_after_sub_discount` —
-- after every voucher and discount, and excluding shipping. That satisfies
-- §3.1's "chỉ tính trên giá trị thực trả của tiền hàng".
--
-- SIGNATURE UNCHANGED, deliberately. `p_items` no longer feeds the arithmetic
-- but is still written into meta.items: it is the only per-line audit trail the
-- ledger has, and 0011's header explains why changing this signature is
-- expensive (both overloads stay resolvable, every call turns ambiguous, and
-- the grant does not survive a drop).

-- ---- the divisor ----
alter table public.loyalty_settings
  add column if not exists vnd_per_point integer not null default 1000
    check (vnd_per_point > 0);

comment on column public.loyalty_settings.vnd_per_point is
  'Đồng of actually-paid money per 1 base point. §5.1 sets this to 1000. '
  'Strictly positive: it is a divisor.';

update public.loyalty_settings set vnd_per_point = 1000 where vnd_per_point is null;

-- ---- claim_points v4 ----
create or replace function public.claim_points(
  p_order_code          text,
  p_phone               text,
  p_full_name           text,
  p_email               text,
  p_pancake_customer_id text,
  p_items               jsonb,
  p_source              text    default 'claim',
  p_order_total         numeric default 0
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings   public.loyalty_settings;
  v_customer   public.customers;
  v_base       numeric := 0;
  v_multiplier numeric := 1;
  v_points     integer;
  v_spend      numeric;
  v_new_spend  numeric;
  v_old_thr    numeric;
  v_new_tier   uuid;
  v_new_thr    numeric;
  v_upgraded   boolean := false;
  v_tier_name  text;
begin
  if p_order_code is null or length(trim(p_order_code)) = 0 then
    raise exception 'order_code required' using errcode = 'P0001';
  end if;
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone required' using errcode = 'P0001';
  end if;
  if p_source is null or p_source not in ('claim', 'webhook', 'admin') then
    raise exception 'invalid source' using errcode = 'P0001';
  end if;

  -- A refund or a malformed total must never pull a lifetime figure down.
  v_spend := greatest(coalesce(p_order_total, 0), 0);

  select * into v_settings from public.loyalty_settings where is_active limit 1;
  if v_settings.id is null then
    raise exception 'no active loyalty settings' using errcode = 'P0004';
  end if;

  insert into public.customers (phone, email, full_name, pancake_customer_id)
  values (trim(p_phone), nullif(trim(coalesce(p_email, '')), ''), p_full_name, p_pancake_customer_id)
  on conflict (phone) do update
    set email               = coalesce(excluded.email, public.customers.email),
        full_name           = coalesce(excluded.full_name, public.customers.full_name),
        pancake_customer_id = coalesce(excluded.pancake_customer_id, public.customers.pancake_customer_id),
        updated_at          = now()
  returning * into v_customer;

  select t.multiplier, t.spend_threshold into v_multiplier, v_old_thr
    from public.membership_tiers t
   where t.id = v_customer.tier_id;

  if v_old_thr is null then
    select t.multiplier, t.spend_threshold into v_multiplier, v_old_thr
      from public.membership_tiers t
     where t.spend_threshold <= v_customer.lifetime_spend
     order by t.spend_threshold desc
     limit 1;
  end if;
  v_multiplier := coalesce(v_multiplier, 1);

  -- §5.1. Always floor here, whatever `rounding` says; see the header.
  v_base := floor(v_spend / v_settings.vnd_per_point);

  v_points := case v_settings.rounding
    when 'floor' then floor(v_base * v_multiplier)
    when 'ceil'  then ceil (v_base * v_multiplier)
    else              round(v_base * v_multiplier)
  end;

  -- Idempotency guard: the partial unique index on order_code is the only thing
  -- standing between a replay and a double credit. `items` is kept in meta as
  -- the per-line audit trail even though it no longer drives the arithmetic;
  -- `vnd_per_point` is stamped so a historical row can be re-derived after the
  -- setting changes.
  begin
    insert into public.transactions (customer_id, phone, type, amount, order_code, source, meta)
    values (v_customer.id, v_customer.phone, 'EARN', v_points, p_order_code, p_source,
            jsonb_build_object('items', p_items, 'multiplier', v_multiplier,
                               'base', v_base, 'order_total', v_spend,
                               'vnd_per_point', v_settings.vnd_per_point));
  exception when unique_violation then
    raise exception 'order already claimed' using errcode = 'P0002';
  end;

  v_new_spend := v_customer.lifetime_spend + v_spend;

  select t.id, t.spend_threshold into v_new_tier, v_new_thr
    from public.membership_tiers t
   where t.spend_threshold <= v_new_spend
   order by t.spend_threshold desc
   limit 1;

  if v_new_tier is not null and (v_old_thr is null or v_new_thr > v_old_thr) then
    v_upgraded := true;
  end if;

  update public.customers
     set current_points  = current_points  + v_points,
         lifetime_points = lifetime_points + v_points,
         lifetime_spend  = lifetime_spend  + v_spend,
         tier_id         = case when v_upgraded then v_new_tier else tier_id end,
         updated_at      = now()
   where id = v_customer.id
  returning * into v_customer;

  select t.name into v_tier_name
    from public.membership_tiers t where t.id = v_customer.tier_id;

  if v_upgraded then
    insert into public.customer_tier_history
      (customer_id, tier_id, tier_name, threshold_amount, spend_at_award, source)
    values (v_customer.id, v_new_tier, coalesce(v_tier_name, ''), v_new_thr,
            v_customer.lifetime_spend, p_source);
  end if;

  return json_build_object(
    'points_awarded',  v_points,
    'current_points',  v_customer.current_points,
    'lifetime_points', v_customer.lifetime_points,
    'lifetime_spend',  v_customer.lifetime_spend,
    'tier_name',       v_tier_name,
    'tier_upgraded',   v_upgraded
  );
end;
$$;

revoke all on function public.claim_points(text, text, text, text, text, jsonb, text, numeric)
  from public, anon, authenticated;
grant execute on function public.claim_points(text, text, text, text, text, jsonb, text, numeric)
  to service_role;

-- ---- retire the per-SKU model ----
--
-- Not expand/contract: this project is pre-launch with no customer data, so the
-- old column and table go in the same migration that stops reading them. The
-- app deploy that removes /admin/products ships alongside.
--
-- 0013_grants.sql still grants on product_points and is deliberately NOT edited:
-- on a replay it runs long before this file, when the table still exists.
drop table if exists public.product_points cascade;

alter table public.loyalty_settings drop column if exists unmapped_sku_points;
