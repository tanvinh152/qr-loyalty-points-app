-- Lucky spin wheel — a gamified earning path alongside the daily check-in (0019).
--
-- Admin defines the slices (name, image, weight, what winning it grants); the
-- member gets a configurable number of free spins per calendar day in Vietnam's
-- timezone. The prize is drawn INSIDE this RPC, exactly like claim_points and
-- redeem_reward decide their own arithmetic: the browser only sends the click,
-- and the wheel animation merely spins to the answer the server already chose.
--
-- Odds are WEIGHTS, not percentages. weight/sum(weight) is the probability, so
-- adding or removing a slice never forces the admin to re-balance the others.
--
-- ONE GIFT CATALOG. A wheel slice is NOT its own table — it is a row of
-- public.rewards carrying kind = 'spin'. The admin manages both kinds of gift
-- on the one /admin/rewards screen, and the two kinds are mutually exclusive:
-- a row is either something a member BUYS with points ('redeem', the shop) or
-- something they WIN ('spin', the wheel), never both. Each kind uses its own
-- disjoint set of columns; the check constraints below are what keep a slice
-- from squatting on the shop's columns.
--
-- Because they now share a table, every shop query has to say
-- `kind = 'redeem'` or a wheel slice leaks into the storefront — see the
-- getActiveRewards / getFeaturedReward / getNextReward / getRewardCategories
-- filters in src/lib/loyalty.ts, and the extra clause in redeem_reward below.
--
-- Images live in the `media` bucket's `spin` folder (src/lib/media.ts).

alter table public.loyalty_settings
  add column if not exists spin_daily_limit integer not null default 0
    check (spin_daily_limit >= 0);   -- 0 = feature off, same convention as checkin_points

-- ---- slices live in public.rewards ----
alter table public.rewards
  add column if not exists kind text not null default 'redeem'
    check (kind in ('redeem', 'spin')),
  -- 'points' credits the balance automatically; 'gift' is a physical prize or
  -- voucher a staff member hands over; 'none' is the "better luck next time"
  -- slice, which still occupies a wedge and still carries a weight. Meaningless
  -- for kind = 'redeem', which is why it defaults to the inert value.
  add column if not exists prize_type text not null default 'none'
    check (prize_type in ('points', 'gift', 'none')),
  add column if not exists points_amount integer not null default 0
    check (points_amount >= 0),
  -- 0 keeps a slice on the wheel's config list but out of the draw.
  add column if not exists weight integer not null default 0 check (weight >= 0),
  add column if not exists sort_order integer not null default 0;

-- A points slice worth nothing is an admin mistake, not a valid prize.
alter table public.rewards drop constraint if exists rewards_spin_points_check;
alter table public.rewards
  add constraint rewards_spin_points_check
  check (kind <> 'spin' or prize_type <> 'points' or points_amount > 0);

-- A slice must not squat on the columns that only mean something in the shop:
-- it is never bought, never the featured hero, never tier-gated.
alter table public.rewards drop constraint if exists rewards_spin_shop_fields_check;
alter table public.rewards
  add constraint rewards_spin_shop_fields_check
  check (kind <> 'spin' or (
    points_cost = 0
    and not is_featured
    and not is_exclusive
    and min_tier_id is null
  ));

-- The two indexes from 0007 now have to exclude slices: a slice must not be
-- able to take the shop's single featured slot, nor invent a shop category.
drop index if exists public.rewards_category_idx;
create index rewards_category_idx
  on public.rewards (category) where is_active and kind = 'redeem';

drop index if exists public.rewards_one_featured;
create unique index rewards_one_featured
  on public.rewards ((true)) where is_featured and is_active and kind = 'redeem';

-- Matches the draw's window ordering and the customer page's render order; the
-- two MUST agree or the wheel stops on the wrong wedge.
create index if not exists rewards_spin_draw_idx
  on public.rewards (sort_order, id) where kind = 'spin' and is_active;

-- ---- wins ----
-- Doubles as the per-day spin counter: there is no separate "spins used" column
-- to drift out of sync with the actual history.
create table if not exists public.spin_results (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers(id) on delete cascade,
  prize_id       uuid references public.rewards(id) on delete set null,
  -- Frozen copies. The admin may rename, re-price or delete a slice later; what
  -- the member won must keep reading the way it read on the day they won it
  -- (same reasoning as redeem_reward's meta->>'reward_name').
  prize_name     text not null,
  prize_type     text not null check (prize_type in ('points', 'gift', 'none')),
  points_awarded integer not null default 0,
  spin_date      date not null,
  -- Gift slices only: when a staff member handed the prize over, and who did.
  fulfilled_at   timestamptz,
  fulfilled_by   uuid,
  created_at     timestamptz not null default now()
);

create index if not exists spin_results_customer_idx
  on public.spin_results (customer_id, created_at desc);

-- The daily-limit count.
create index if not exists spin_results_today_idx
  on public.spin_results (customer_id, spin_date);

-- The admin's hand-over queue.
create index if not exists spin_results_pending_idx
  on public.spin_results (created_at desc)
  where prize_type = 'gift' and fulfilled_at is null;

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('claim', 'webhook', 'admin', 'redeem', 'welcome', 'checkin', 'spin'));

-- ---- RLS ----
-- public.rewards already carries the right posture from 0005 ("read active
-- rewards" lets anon see is_active rows and an admin see everything, "admin
-- manage rewards" owns every write), and the grants from 0013. Folding the
-- slices into that table means there is nothing new to authorise here.
alter table public.spin_results enable row level security;

drop policy if exists "read own spin results" on public.spin_results;
create policy "read own spin results"
  on public.spin_results for select to authenticated
  using (
    public.is_admin()
    or customer_id in (
      select c.id from public.customers c where c.auth_user_id = auth.uid()
    )
  );

-- UPDATE is how the admin marks a gift as handed over. No customer write path:
-- the wins themselves are only ever written by the RPC below.
drop policy if exists "admin update spin results" on public.spin_results;
create policy "admin update spin results"
  on public.spin_results for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- grants ----
-- A policy without its grant is unreachable; see 0013_grants.sql.
grant select on public.spin_results to authenticated;
grant update on public.spin_results to authenticated;

-- ---- redemption is shop-only ----
-- Same body as 0017 plus one clause: a slice is not merchandise, so sending its
-- id to redeem_reward must read as "no such reward" rather than handing over a
-- wheel prize for points.
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
   where id = p_reward_id and is_active and kind = 'redeem'
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

-- ---- the draw ----
-- Sharing `quantity` with the shop means a gift slice now has real stock: a
-- sold-out gift drops out of the draw entirely rather than being won forever.
-- If every remaining slice is a sold-out gift the eligible weight reaches zero
-- and this raises P0004, which the UI reads as "the wheel is off" — so an admin
-- should always keep one 'none' slice active as the floor.
create or replace function public.spin_wheel(
  p_customer_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings     public.loyalty_settings;
  v_customer     public.customers;
  v_date         date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_used         integer;
  v_total        bigint;
  v_roll         numeric;
  v_prize_id     uuid;
  v_prize_name   text;
  v_prize_type   text;
  v_prize_points integer;
  v_awarded      integer := 0;
  v_result_id    uuid;
begin
  -- Lock first. This row lock is what serializes two concurrent spins from the
  -- same member, and therefore what makes the count below trustworthy.
  select * into v_customer from public.customers where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found' using errcode = 'P0001';
  end if;

  select * into v_settings from public.loyalty_settings where is_active limit 1;
  if v_settings.id is null then
    raise exception 'no active loyalty settings' using errcode = 'P0004';
  end if;

  if v_settings.spin_daily_limit <= 0 then
    raise exception 'spin disabled' using errcode = 'P0005';
  end if;

  select count(*) into v_used
    from public.spin_results
   where customer_id = v_customer.id and spin_date = v_date;

  if v_used >= v_settings.spin_daily_limit then
    raise exception 'no spins left today' using errcode = 'P0002';
  end if;

  -- The customer lock above only serializes THIS member; two different members
  -- can still race for the last unit of a gift. So the decrement is conditional
  -- and a lost race re-draws — by then the slice reads quantity = 0 and is no
  -- longer eligible, so the retry cannot pick it again.
  for v_try in 1..5 loop
    v_prize_id := null;

    select coalesce(sum(weight), 0) into v_total
      from public.rewards
     where kind = 'spin' and is_active and weight > 0
       and (prize_type <> 'gift' or quantity > 0);

    exit when v_total <= 0;

    -- Weighted draw: walk the running total of the weights and take the first
    -- slice whose cumulative weight passes a uniform roll in [0, total).
    v_roll := random() * v_total;

    select q.id, q.name, q.prize_type, q.points_amount
      into v_prize_id, v_prize_name, v_prize_type, v_prize_points
    from (
      select p.id, p.name, p.prize_type, p.points_amount,
             sum(p.weight) over (
               order by p.sort_order, p.id
               rows between unbounded preceding and current row
             ) as running
        from public.rewards p
       where p.kind = 'spin' and p.is_active and p.weight > 0
         and (p.prize_type <> 'gift' or p.quantity > 0)
    ) q
    where q.running > v_roll
    order by q.running
    limit 1;

    exit when v_prize_id is null;          -- nothing eligible; fall through to P0004
    exit when v_prize_type <> 'gift';      -- points/none slices hold no stock

    update public.rewards
       set quantity = quantity - 1
     where id = v_prize_id and quantity > 0;

    exit when found;

    -- Lost the race for the last unit. Clearing this is what makes a loop that
    -- runs out of tries fall through to P0004 instead of awarding a gift whose
    -- stock was never decremented.
    v_prize_id := null;
  end loop;

  if v_prize_id is null then
    raise exception 'no spin prizes configured' using errcode = 'P0004';
  end if;

  if v_prize_type = 'points' then
    v_awarded := v_prize_points;
  end if;

  insert into public.spin_results
    (customer_id, prize_id, prize_name, prize_type, points_awarded, spin_date)
  values
    (v_customer.id, v_prize_id, v_prize_name, v_prize_type, v_awarded, v_date)
  returning id into v_result_id;

  -- Only a points slice moves money. A gift is settled by hand, and 'none'
  -- deliberately leaves no ledger row at all.
  if v_awarded > 0 then
    insert into public.transactions
      (customer_id, phone, type, amount, order_code, source, meta)
    values
      (v_customer.id, v_customer.phone, 'EARN', v_awarded, null, 'spin',
       jsonb_build_object('prize_name', v_prize_name, 'spin_result_id', v_result_id));

    update public.customers
       set current_points  = current_points  + v_awarded,
           lifetime_points = lifetime_points + v_awarded,
           updated_at      = now()
     where id = v_customer.id
    returning * into v_customer;
  end if;

  return json_build_object(
    'result_id',      v_result_id,
    'prize_id',       v_prize_id,
    'prize_name',     v_prize_name,
    'prize_type',     v_prize_type,
    'points_awarded', v_awarded,
    'current_points', v_customer.current_points,
    'spins_left',     v_settings.spin_daily_limit - v_used - 1
  );
end;
$$;

revoke all on function public.spin_wheel(uuid) from public, anon, authenticated;
grant execute on function public.spin_wheel(uuid) to service_role;
