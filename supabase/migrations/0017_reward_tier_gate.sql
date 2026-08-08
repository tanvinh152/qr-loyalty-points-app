-- Reward redemption gated by minimum tier.
--
-- `min_tier_id` is nullable: no value means no restriction, which is what
-- every existing reward keeps meaning. Compared by spend_threshold, the same
-- monotonic measure every other tier comparison in this schema uses (0010,
-- 0011, 0016) — never by name or by the admin-editable sort_order.
--
-- `on delete set null`: dropping a tier lifts the gate rather than blocking
-- the tier delete or deleting the reward out from under the shop.

alter table public.rewards
  add column if not exists min_tier_id uuid
    references public.membership_tiers(id) on delete set null;

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
  v_reward       public.rewards;
  v_customer     public.customers;
  v_min_thr      numeric;
  v_customer_thr numeric;
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

  -- customers.tier_id is the highest tier EVER held (0010, sticky), so this
  -- reads the same tier the customer's own screens show via resolveDisplayTier
  -- — a NULL tier_id (nobody who can afford a reward should ever have one, see
  -- claim_points) floors at -1, below even the 0đ Bạc tier.
  if v_reward.min_tier_id is not null then
    select spend_threshold into v_min_thr
      from public.membership_tiers where id = v_reward.min_tier_id;

    select spend_threshold into v_customer_thr
      from public.membership_tiers where id = v_customer.tier_id;

    if v_min_thr is not null and coalesce(v_customer_thr, -1) < v_min_thr then
      raise exception 'tier too low' using errcode = 'P0006';
    end if;
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
