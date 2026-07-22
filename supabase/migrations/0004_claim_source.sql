-- Adds p_source to claim_points so the Pancake webhook can write 'webhook' rows.
--
-- Adding a defaulted parameter to the existing 6-arg function would leave TWO
-- overloads behind and make every call ambiguous, so the old signature is
-- dropped first. The grant does not survive the drop — it is re-issued below
-- for the new 7-arg signature.
--
-- Body is otherwise identical to 0003_claim_rpc.sql. It MUST still stay in sync
-- with calcOrderPoints() in src/lib/points.ts (UI preview).

drop function if exists public.claim_points(text, text, text, text, text, jsonb);

create or replace function public.claim_points(
  p_order_code          text,
  p_phone               text,
  p_full_name           text,
  p_email               text,
  p_pancake_customer_id text,
  p_items               jsonb,
  p_source              text default 'claim'
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
  v_old_tier   uuid;
  v_new_tier   uuid;
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

  -- Tier the customer is in BEFORE this earn. A brand-new customer has no
  -- tier_id yet, so fall back to whatever their lifetime_points earns them —
  -- that way the first claim doesn't report a bogus "upgrade".
  select t.id, t.multiplier into v_old_tier, v_multiplier
    from public.membership_tiers t
   where t.id = v_customer.tier_id;

  if v_old_tier is null then
    select t.id, t.multiplier into v_old_tier, v_multiplier
      from public.membership_tiers t
     where t.threshold <= v_customer.lifetime_points
     order by t.threshold desc
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
  -- standing between a replay and a double credit. It is shared by the manual
  -- claim and the webhook, so whichever arrives second is rejected here.
  begin
    insert into public.transactions (customer_id, phone, type, amount, order_code, source, meta)
    values (v_customer.id, v_customer.phone, 'EARN', v_points, p_order_code, p_source,
            jsonb_build_object('items', p_items, 'multiplier', v_multiplier, 'base', v_base));
  exception when unique_violation then
    raise exception 'order already claimed' using errcode = 'P0002';
  end;

  -- Balance + tier recalculation.
  select t.id into v_new_tier
    from public.membership_tiers t
   where t.threshold <= v_customer.lifetime_points + v_points
   order by t.threshold desc
   limit 1;

  update public.customers
     set current_points  = current_points  + v_points,
         lifetime_points = lifetime_points + v_points,
         tier_id         = coalesce(v_new_tier, tier_id),
         updated_at      = now()
   where id = v_customer.id
  returning * into v_customer;

  select t.name into v_tier_name
    from public.membership_tiers t where t.id = v_customer.tier_id;

  return json_build_object(
    'points_awarded',  v_points,
    'current_points',  v_customer.current_points,
    'lifetime_points', v_customer.lifetime_points,
    'tier_name',       v_tier_name,
    'tier_upgraded',   v_new_tier is not null and v_new_tier is distinct from v_old_tier
  );
end;
$$;

revoke all on function public.claim_points(text, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.claim_points(text, text, text, text, text, jsonb, text)
  to service_role;
