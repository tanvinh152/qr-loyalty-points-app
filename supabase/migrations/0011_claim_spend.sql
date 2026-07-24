-- claim_points v3: credit spend as well as points, and derive the tier from spend.
--
-- Copy of 0004_claim_source.sql with three changes:
--   * a new `p_order_total` parameter — the order's money, kept apart from its
--     points because the two now feed different columns;
--   * `lifetime_spend` accumulates it;
--   * the tier is looked up by `spend_threshold` and is STICKY — it only ever
--     moves up. A raised threshold must never demote a member (see 0010).
--
-- The point arithmetic itself is untouched, including the multiplier, which
-- still comes from the tier the customer holds when the order lands. It MUST
-- still stay in sync with calcOrderPoints() in src/lib/points.ts.
--
-- The 7-arg overload is dropped first: adding a defaulted parameter would leave
-- both signatures resolvable and make every call ambiguous. The grant does not
-- survive the drop and is re-issued at the bottom.

drop function if exists public.claim_points(text, text, text, text, text, jsonb, text);

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
  -- The threshold of the tier the customer HOLDS, which is what an upgrade has
  -- to beat. Comparing thresholds rather than tier ids is what makes this
  -- monotonic: a tier whose bar is lower can never win.
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
  -- Mirrors the transactions.source check constraint; fail loudly rather than
  -- letting a typo land as a constraint violation with a useless error code.
  if p_source is null or p_source not in ('claim', 'webhook', 'admin') then
    raise exception 'invalid source' using errcode = 'P0001';
  end if;

  -- A refund or a malformed total must never pull a lifetime figure down.
  v_spend := greatest(coalesce(p_order_total, 0), 0);

  select * into v_settings from public.loyalty_settings where is_active limit 1;
  if v_settings.id is null then
    raise exception 'no active loyalty settings' using errcode = 'P0004';
  end if;

  -- Upsert customer on phone; contact fields only ever get filled in, never blanked.
  insert into public.customers (phone, email, full_name, pancake_customer_id)
  values (trim(p_phone), nullif(trim(coalesce(p_email, '')), ''), p_full_name, p_pancake_customer_id)
  on conflict (phone) do update
    set email               = coalesce(excluded.email, public.customers.email),
        full_name           = coalesce(excluded.full_name, public.customers.full_name),
        pancake_customer_id = coalesce(excluded.pancake_customer_id, public.customers.pancake_customer_id),
        updated_at          = now()
  returning * into v_customer;

  -- The tier in force BEFORE this order, for the multiplier and as the floor an
  -- upgrade has to clear. A customer with no tier_id yet falls back to whatever
  -- their spend already earns, so the first claim cannot report a bogus upgrade.
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

  -- Per-SKU base points. Unknown or inactive SKU -> configured fallback.
  select coalesce(sum(i.qty * coalesce(pp.points_awarded, v_settings.unmapped_sku_points)), 0)
    into v_base
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as i(sku text, qty integer)
    left join public.product_points pp
      on pp.product_code = i.sku and pp.is_active
   where coalesce(i.qty, 0) > 0;

  v_points := case v_settings.rounding
    when 'floor' then floor(v_base * v_multiplier)
    when 'ceil'  then ceil (v_base * v_multiplier)
    else              round(v_base * v_multiplier)
  end;

  -- Idempotency guard: the partial unique index on order_code is the only thing
  -- standing between a replay and a double credit. It is shared by signup's
  -- proof order and the webhook, so whichever arrives second is rejected here.
  -- `order_total` is on the row so a spend total can be rebuilt or reconciled
  -- from the ledger alone.
  begin
    insert into public.transactions (customer_id, phone, type, amount, order_code, source, meta)
    values (v_customer.id, v_customer.phone, 'EARN', v_points, p_order_code, p_source,
            jsonb_build_object('items', p_items, 'multiplier', v_multiplier,
                               'base', v_base, 'order_total', v_spend));
  exception when unique_violation then
    raise exception 'order already claimed' using errcode = 'P0002';
  end;

  v_new_spend := v_customer.lifetime_spend + v_spend;

  -- Highest tier this spend reaches...
  select t.id, t.spend_threshold into v_new_tier, v_new_thr
    from public.membership_tiers t
   where t.spend_threshold <= v_new_spend
   order by t.spend_threshold desc
   limit 1;

  -- ...but only accepted when it is genuinely higher than the tier already held.
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
