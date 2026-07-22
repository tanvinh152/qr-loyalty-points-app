-- Manual staff adjustment — the only write path for an ADJUST row.
--
-- Same posture as claim_points (0003) and redeem_reward (0006): SECURITY DEFINER,
-- granted to service_role ONLY. The Server Action in
-- src/app/admin/customers/[id]/actions.ts re-checks the caller's admin claim
-- before reaching for createAdminClient().
--
-- Why this exists: Pancake masks phone numbers on EVERY endpoint (orders/list
-- returns "0****89" just like orders/get), so there is no way to backfill a
-- long-standing customer's history — the webhook can only attribute orders once
-- a manual /claim has linked their pancake_customer_id. On launch day that
-- leaves loyal customers sitting at zero, and this is how staff fix it.
--
-- Granting a TIER never writes customers.tier_id directly. claim_points
-- recomputes tier_id from lifetime_points on every claim (0003), so a
-- hand-written tier would be silently overwritten by the next order. Instead a
-- tier grant raises lifetime_points to that tier's threshold and lets the tier
-- derive itself, exactly as an earned tier would. Grant-only: a lower tier never
-- pulls lifetime_points down, mirroring 0006's "tiers are earned, spending must
-- never demote anyone". A deliberate demotion is a negative p_lifetime_delta.

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
  v_threshold       integer;
  v_current_target  integer;
  v_lifetime_target integer;
  v_lifetime_delta  integer;
  v_old_tier        uuid;
  v_new_tier        uuid;
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

  v_current_target := v_customer.current_points  + coalesce(p_current_delta, 0);
  v_lifetime_target := v_customer.lifetime_points + coalesce(p_lifetime_delta, 0);

  if p_grant_tier_id is not null then
    select t.threshold into v_threshold
      from public.membership_tiers t
     where t.id = p_grant_tier_id;

    if v_threshold is null then
      raise exception 'tier not found' using errcode = 'P0001';
    end if;

    v_lifetime_target := greatest(v_lifetime_target, v_threshold);
  end if;

  v_lifetime_delta := v_lifetime_target - v_customer.lifetime_points;

  -- Its own errcode because the most likely way to land here is picking a tier
  -- the customer already outranks — the form says so rather than failing blankly.
  if v_current_target = v_customer.current_points and v_lifetime_delta = 0 then
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

  v_old_tier := v_customer.tier_id;

  -- Same query as claim_points (0003): the two paths must never disagree about
  -- which tier a lifetime total earns.
  select t.id into v_new_tier
    from public.membership_tiers t
   where t.threshold <= v_lifetime_target
   order by t.threshold desc
   limit 1;

  update public.customers
     set current_points  = v_current_target,
         lifetime_points = v_lifetime_target,
         tier_id         = coalesce(v_new_tier, tier_id),
         updated_at      = now()
   where id = v_customer.id
  returning * into v_customer;

  select t.name into v_tier_name
    from public.membership_tiers t where t.id = v_customer.tier_id;

  return json_build_object(
    'current_points',  v_customer.current_points,
    'lifetime_points', v_customer.lifetime_points,
    'tier_name',       v_tier_name,
    'tier_changed',    v_customer.tier_id is distinct from v_old_tier
  );
end;
$$;

revoke all on function public.adjust_points(uuid, integer, integer, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.adjust_points(uuid, integer, integer, uuid, text, jsonb)
  to service_role;
