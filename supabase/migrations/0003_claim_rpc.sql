-- Atomic, single-use claim. Called by the customer portal Server Action via anon client.
-- SECURITY DEFINER: runs with owner rights so it can write despite restrictive RLS,
-- but its ONLY effect is the guarded claim below.

create or replace function public.claim_points(
  p_order_code text,
  p_full_name  text,
  p_email      text,
  p_phone      text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id   uuid;
  v_total      numeric;
  v_settings   public.point_settings;
  v_points     integer;
  v_customer   public.customers;
begin
  if p_order_code is null or length(trim(p_order_code)) = 0 then
    raise exception 'order_code required' using errcode = 'P0001';
  end if;
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone required' using errcode = 'P0001';
  end if;

  -- Guarded, single-use claim: only a pending order flips to claimed.
  update public.orders
     set status = 'claimed'
   where order_code = p_order_code
     and status = 'pending'
  returning id, total into v_order_id, v_total;

  if v_order_id is null then
    if exists (select 1 from public.orders where order_code = p_order_code) then
      raise exception 'order already claimed' using errcode = 'P0002';
    else
      raise exception 'order not found' using errcode = 'P0003';
    end if;
  end if;

  -- Active settings are the source of truth for point calc.
  select * into v_settings from public.point_settings where is_active limit 1;
  if v_settings.id is null then
    raise exception 'no active point settings' using errcode = 'P0004';
  end if;

  if v_total < v_settings.min_order_value then
    v_points := 0;
  else
    v_points := case v_settings.rounding
      when 'floor' then floor(v_total * v_settings.conversion_rate)
      when 'ceil'  then ceil(v_total * v_settings.conversion_rate)
      else              round(v_total * v_settings.conversion_rate)
    end;
  end if;

  -- Upsert customer on phone, refresh contact info, increment balance.
  insert into public.customers (phone, email, full_name, total_points)
  values (p_phone, p_email, p_full_name, v_points)
  on conflict (phone) do update
    set total_points = public.customers.total_points + excluded.total_points,
        email        = coalesce(excluded.email, public.customers.email),
        full_name    = coalesce(excluded.full_name, public.customers.full_name)
  returning * into v_customer;

  -- Ledger. unique(order_id) is a second guard against double-claim.
  insert into public.point_transactions (customer_id, order_id, points)
  values (v_customer.id, v_order_id, v_points);

  return json_build_object(
    'points_awarded', v_points,
    'total_points',   v_customer.total_points
  );
end;
$$;

-- Lock down, then grant only to the anon role that the portal uses.
revoke all on function public.claim_points(text, text, text, text) from public;
grant execute on function public.claim_points(text, text, text, text) to anon;
