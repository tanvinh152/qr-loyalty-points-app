-- Spend milestones — "Lộ trình phần thưởng", the ladder of gifts a member
-- unlocks by accumulating lifetime SPEND (gap G6 in
-- docs/gap-analysis-vs-client-spec.md, §7.2 of the client spec).
--
-- INDEPENDENT OF TIERS. Milestones share exactly one thing with
-- membership_tiers: the unit. Both are measured in đồng against
-- customers.lifetime_spend. Nothing else is shared — passing a milestone does
-- not move a tier, and reaching a tier does not claim a milestone.
--
-- ONE GIFT CATALOG, as 0022 established for the wheel. A milestone is NOT its
-- own table: it is a row of public.rewards carrying kind = 'milestone'. That
-- buys the RLS posture of 0005, the grants of 0013, the admin screen's kind
-- tabs and the media pipeline for free, and it keeps the three kinds of gift
-- describable in one place. The check constraints below are what stop a
-- milestone squatting on the shop's columns OR the wheel's.
--
-- Every shop query already pins kind = 'redeem' (getActiveRewards,
-- getRewardCategories, getFeaturedReward, getNextReward in src/lib/loyalty.ts),
-- and rewards_category_idx / rewards_one_featured are already partial on it, so
-- a third kind cannot leak into the storefront.
--
-- NO VOUCHER ENGINE (gap G4). A milestone prize is therefore a physical
-- hand-over at the counter, exactly like a spin prize with prize_type = 'gift'.
-- This ladder credits no points and writes NO transactions row, which is why
-- transactions_source_check is deliberately left alone below.
--
-- UNLOCKING IS DERIVED, NOT MATERIALISED. Eligibility is
-- lifetime_spend >= spend_threshold, computed at read time. It is emphatically
-- NOT hooked into claim_points, because claim_points is not the only writer of
-- lifetime_spend: adjust_customer_points (0012) and reconcile_order_spend
-- (0016) move it too. A milestone unlocked only inside claim_points would be
-- permanently unreachable for anyone pushed over a rung by an admin adjustment
-- or a TikTok reconciliation, and copying the logic into all three is the
-- second-implementation trap AGENTS.md forbids. Deriving it means the state is
-- right through every write path, and right again when an admin edits a rung.
--
-- Consequence, stated on purpose: a future refund/reversal (G3) could drop
-- lifetime_spend back below a rung a member already claimed. The award row is
-- NEVER retracted — the same posture as the sticky customers.tier_id in 0010.

-- ---- rewards gains a third kind ----
-- Dropped by its real name: verified on the hosted database, which has drifted
-- from this ledger twice before.
alter table public.rewards drop constraint if exists rewards_kind_check;
alter table public.rewards
  add constraint rewards_kind_check check (kind in ('redeem', 'spin', 'milestone'));

alter table public.rewards
  add column if not exists spend_threshold numeric(14,0);

comment on column public.rewards.spend_threshold is
  'Lifetime spend in đồng that unlocks this milestone. Measured against '
  'customers.lifetime_spend, NEVER against points. NULL on every other kind.';

-- The column belongs to exactly one kind, in BOTH directions: a milestone
-- without a rung is unreachable, and a shop reward carrying one is a lie.
alter table public.rewards drop constraint if exists rewards_threshold_kind_check;
alter table public.rewards
  add constraint rewards_threshold_kind_check
  check (
    (kind = 'milestone') = (spend_threshold is not null)
    and (spend_threshold is null or spend_threshold > 0)
  );

-- A milestone must not squat on the shop's columns or the wheel's. Note
-- quantity = 0: a milestone is a PUBLISHED PROMISE ("spend 400k and the gift is
-- yours"), so a member who reaches the rung and is told "out of stock" is a
-- support ticket, not a feature. The admin's lever is is_active, and the
-- pending-awards queue is what tells staff how many to have on hand.
alter table public.rewards drop constraint if exists rewards_milestone_fields_check;
alter table public.rewards
  add constraint rewards_milestone_fields_check
  check (kind <> 'milestone' or (
    points_cost   = 0
    and quantity  = 0
    and weight    = 0
    and points_amount = 0
    and prize_type = 'none'
    and not is_featured
    and not is_exclusive
    and min_tier_id is null
  ));

-- rewards_spin_shop_fields_check and rewards_spin_points_check need no edit:
-- both read `kind <> 'spin' or (…)` and stay true for a third kind.

-- One active gift per rung — the mockup draws one node per rung, and the
-- rewards_one_featured precedent says a partial unique index is how this repo
-- expresses "at most one". A combined prize ("Voucher 50K + 1 túi cát") is one
-- row whose description names both halves. Inactive rows are exempt, so a rung
-- can be replaced without a dance.
create unique index if not exists rewards_milestone_threshold_idx
  on public.rewards (spend_threshold) where kind = 'milestone' and is_active;

-- ---- claims ----
create table if not exists public.milestone_awards (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers(id) on delete cascade,
  milestone_id     uuid references public.rewards(id) on delete set null,
  -- Frozen copies. The admin may rename, re-price or delete a rung later; what
  -- the member claimed must keep reading the way it read on the day they
  -- claimed it (same reasoning as spin_results.prize_name and
  -- customer_tier_history.tier_name).
  milestone_name   text          not null,
  threshold_amount numeric(14,0) not null,
  spend_at_claim   numeric(14,0) not null,
  -- Gift hand-over: when a staff member handed it over, and who did.
  fulfilled_at     timestamptz,
  fulfilled_by     uuid,
  created_at       timestamptz not null default now()
);

-- The idempotency guard: one claim per member per rung, so a double-click or a
-- retried request can never award twice. NULLs compare as distinct here, which
-- is exactly right — `on delete set null` above means a rung that was deleted
-- and recreated becomes claimable again rather than colliding with history.
create unique index if not exists milestone_awards_once_idx
  on public.milestone_awards (customer_id, milestone_id);

create index if not exists milestone_awards_customer_idx
  on public.milestone_awards (customer_id, created_at desc);

-- The admin's hand-over queue. No prize_type filter, unlike
-- spin_results_pending_idx: every milestone prize is handed over by hand.
create index if not exists milestone_awards_pending_idx
  on public.milestone_awards (created_at desc) where fulfilled_at is null;

-- ---- RLS ----
-- public.rewards already carries the right posture from 0005 and the grants
-- from 0013, so the rungs themselves need nothing new here.
alter table public.milestone_awards enable row level security;

drop policy if exists "read own milestone awards" on public.milestone_awards;
create policy "read own milestone awards"
  on public.milestone_awards for select to authenticated
  using (
    public.is_admin()
    or customer_id in (
      select c.id from public.customers c where c.auth_user_id = auth.uid()
    )
  );

-- UPDATE is how the admin marks a prize as handed over. No customer write path
-- and no INSERT policy at all: awards are only ever written by the RPC below.
drop policy if exists "admin update milestone awards" on public.milestone_awards;
create policy "admin update milestone awards"
  on public.milestone_awards for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- grants ----
-- A policy without its grant is unreachable; see 0013_grants.sql.
grant select on public.milestone_awards to authenticated;
grant update on public.milestone_awards to authenticated;

-- ---- claiming ----
create or replace function public.claim_milestone_reward(
  p_customer_id  uuid,
  p_milestone_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer  public.customers;
  v_milestone public.rewards;
  v_award_id  uuid;
begin
  -- Locking the customer row is what serialises a double-click: the eligibility
  -- read and the insert have to be one indivisible step.
  select * into v_customer from public.customers where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found' using errcode = 'P0001';
  end if;

  -- The kind clause is the defence redeem_reward gained in 0022: a forged shop
  -- reward id must read as "no such milestone", not hand over merchandise.
  select * into v_milestone
    from public.rewards
   where id = p_milestone_id and is_active and kind = 'milestone';

  if v_milestone.id is null then
    raise exception 'milestone not found' using errcode = 'P0001';
  end if;

  if v_milestone.spend_threshold > v_customer.lifetime_spend then
    raise exception 'milestone locked' using errcode = 'P0006';
  end if;

  begin
    insert into public.milestone_awards (
      customer_id, milestone_id, milestone_name, threshold_amount, spend_at_claim
    )
    values (
      v_customer.id, v_milestone.id, v_milestone.name,
      v_milestone.spend_threshold, v_customer.lifetime_spend
    )
    returning id into v_award_id;
  exception when unique_violation then
    raise exception 'milestone already claimed' using errcode = 'P0003';
  end;

  -- No transactions row and no customers update: nothing moves. The prize is
  -- settled by hand, exactly like the gift branch of spin_wheel.
  return json_build_object(
    'award_id',         v_award_id,
    'milestone_id',     v_milestone.id,
    'milestone_name',   v_milestone.name,
    'threshold_amount', v_milestone.spend_threshold,
    'lifetime_spend',   v_customer.lifetime_spend
  );
end;
$$;

revoke all on function public.claim_milestone_reward(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_milestone_reward(uuid, uuid) to service_role;
