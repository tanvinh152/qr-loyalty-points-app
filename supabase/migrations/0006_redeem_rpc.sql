-- Atomic reward redemption — the only write path for a REDEEM row.
--
-- Same posture as claim_points (0004): SECURITY DEFINER, granted to service_role
-- ONLY. The caller passes a customer id it resolved from the session, so anon
-- must never be able to hand this a foreign id. The Server Action in
-- src/app/(customer)/rewards/actions.ts calls it with createAdminClient() after
-- reading the Supabase session.
--
-- lifetime_points is deliberately NOT touched: tiers are earned, spending must
-- never demote anyone.

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('claim', 'webhook', 'admin', 'redeem'));

create or replace function public.redeem_reward(
  p_customer_id uuid,
  p_reward_id   uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward   public.rewards;
  v_customer public.customers;
begin
  -- Lock the reward row first: the stock check and the decrement have to be one
  -- indivisible step or two concurrent redemptions both pass on the last unit.
  select * into v_reward
    from public.rewards
   where id = p_reward_id and is_active
     for update;

  if v_reward.id is null then
    raise exception 'reward not found' using errcode = 'P0001';
  end if;

  if v_reward.quantity <= 0 then
    raise exception 'reward out of stock' using errcode = 'P0002';
  end if;

  select * into v_customer
    from public.customers
   where id = p_customer_id
     for update;

  if v_customer.id is null then
    raise exception 'customer not found' using errcode = 'P0001';
  end if;

  if v_customer.current_points < v_reward.points_cost then
    raise exception 'insufficient points' using errcode = 'P0003';
  end if;

  insert into public.transactions
    (customer_id, phone, type, amount, order_code, source, reward_id, meta)
  values
    (v_customer.id, v_customer.phone, 'REDEEM', -v_reward.points_cost, null, 'redeem',
     v_reward.id, jsonb_build_object('reward_name', v_reward.name,
                                     'points_cost', v_reward.points_cost));

  update public.rewards
     set quantity = quantity - 1
   where id = v_reward.id;

  update public.customers
     set current_points = current_points - v_reward.points_cost,
         updated_at     = now()
   where id = v_customer.id
  returning * into v_customer;

  return json_build_object(
    'reward_id',      v_reward.id,
    'reward_name',    v_reward.name,
    'points_spent',   v_reward.points_cost,
    'current_points', v_customer.current_points
  );
end;
$$;

revoke all on function public.redeem_reward(uuid, uuid) from public, anon, authenticated;
grant execute on function public.redeem_reward(uuid, uuid) to service_role;
