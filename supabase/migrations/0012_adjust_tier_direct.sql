-- adjust_points v2: a tier grant now writes customers.tier_id directly.
--
-- Same signature as 0008 (so this is a plain create-or-replace), different
-- meaning for `p_grant_tier_id`.
--
-- 0008 turned a tier grant into a `lifetime_points` floor and let the tier derive
-- itself, because claim_points recomputed tier_id from lifetime_points on every
-- order and would have overwritten a hand-written tier. Since 0010/0011 that is
-- no longer true: `customers.tier_id` is the highest tier ever held and only ever
-- moves up, so a granted tier sticks on its own. Inflating a lifetime figure to
-- fake it would now be actively wrong — `lifetime_spend` is money the shop
-- actually took, and `tier_percentile_amount()` ranks the member base by it.
--
-- Still grant-only: a tier whose spend_threshold is at or below the one already
-- held is refused (P0005), mirroring 0006's "tiers are earned, nothing may
-- demote anyone". A deliberate demotion is a manual DB edit, not a form field.
-- Points can still be granted in the same call.

create or replace function public.adjust_points(
  p_customer_id    uuid,
  p_current_delta  integer,
  p_lifetime_delta integer,
  p_grant_tier_id  uuid,
  p_reason         text,
  p_actor          jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer        public.customers;
  v_grant_thr       numeric;
  v_old_thr         numeric;
  v_current_target  integer;
  v_lifetime_target integer;
  v_lifetime_delta  integer;
  v_new_tier        uuid;
  v_tier_changed    boolean := false;
  v_tier_name       text;
begin
  if coalesce(length(trim(p_reason)), 0) = 0 then
    raise exception 'reason required' using errcode = 'P0001';
  end if;

  -- Locked for the whole adjustment: the read of the current balance and the
  -- write that depends on it have to be one indivisible step, or a concurrent
  -- redemption slips between them.
  select * into v_customer
    from public.customers
   where id = p_customer_id
     for update;

  if v_customer.id is null then
    raise exception 'customer not found' using errcode = 'P0001';
  end if;

  v_current_target  := v_customer.current_points  + coalesce(p_current_delta, 0);
  v_lifetime_target := v_customer.lifetime_points + coalesce(p_lifetime_delta, 0);
  v_lifetime_delta  := v_lifetime_target - v_customer.lifetime_points;
  v_new_tier        := v_customer.tier_id;

  if p_grant_tier_id is not null then
    select t.spend_threshold into v_grant_thr
      from public.membership_tiers t
     where t.id = p_grant_tier_id;

    if v_grant_thr is null then
      raise exception 'tier not found' using errcode = 'P0001';
    end if;

    select t.spend_threshold into v_old_thr
      from public.membership_tiers t
     where t.id = v_customer.tier_id;

    -- Thresholds, not sort_order: sort_order is a free integer an admin can set
    -- to anything, and the ladder the rest of the app reads is the money one.
    if v_old_thr is null or v_grant_thr > v_old_thr then
      v_new_tier     := p_grant_tier_id;
      v_tier_changed := true;
    end if;
  end if;

  -- Its own errcode because the most likely way to land here is picking a tier
  -- the customer already outranks — the form says so rather than failing blankly.
  if v_current_target = v_customer.current_points
     and v_lifetime_delta = 0
     and not v_tier_changed then
    raise exception 'no-op adjustment' using errcode = 'P0005';
  end if;

  -- Reported rather than left to the check constraints on customers (0001), so
  -- the form can say "not enough points" instead of surfacing a 23514.
  if v_current_target < 0 or v_lifetime_target < 0 then
    raise exception 'insufficient points' using errcode = 'P0003';
  end if;

  -- `amount` is the flow of SPENDABLE points — that is what the transactions
  -- screen sums. A pure tier grant moves none, so it records a 0 and carries the
  -- detail in meta.
  insert into public.transactions
    (customer_id, phone, type, amount, order_code, source, meta)
  values
    (v_customer.id, v_customer.phone, 'ADJUST', coalesce(p_current_delta, 0), null, 'admin',
     jsonb_build_object('reason',          trim(p_reason),
                        'actor',           p_actor,
                        'current_delta',   coalesce(p_current_delta, 0),
                        'lifetime_delta',  v_lifetime_delta,
                        'granted_tier_id', p_grant_tier_id));

  -- lifetime_spend is deliberately absent: a granted tier is a decision, not
  -- revenue, and inventing spend would corrupt every percentile.
  update public.customers
     set current_points  = v_current_target,
         lifetime_points = v_lifetime_target,
         tier_id         = v_new_tier,
         updated_at      = now()
   where id = v_customer.id
  returning * into v_customer;

  select t.name into v_tier_name
    from public.membership_tiers t where t.id = v_customer.tier_id;

  if v_tier_changed then
    insert into public.customer_tier_history
      (customer_id, tier_id, tier_name, threshold_amount, spend_at_award, source)
    values (v_customer.id, v_new_tier, coalesce(v_tier_name, ''), v_grant_thr,
            v_customer.lifetime_spend, 'admin');
  end if;

  return json_build_object(
    'current_points',  v_customer.current_points,
    'lifetime_points', v_customer.lifetime_points,
    'tier_name',       v_tier_name,
    'tier_changed',    v_tier_changed
  );
end;
$$;

revoke all on function public.adjust_points(uuid, integer, integer, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.adjust_points(uuid, integer, integer, uuid, text, jsonb)
  to service_role;
