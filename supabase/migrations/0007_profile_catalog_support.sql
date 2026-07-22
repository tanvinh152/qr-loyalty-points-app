-- Phase 5: everything the Chicha Pet Members redesign needs that 0001 did not have.
--
-- Three unrelated concerns land together because they are one UI release:
--   1. customers  — the owner + pet profile the setup screen collects
--   2. rewards    — catalog metadata the shop screen filters and badges on
--   3. membership_tiers.perks — structured benefits for the tier screen
--   4. support_requests — the help centre's contact form
--
-- Write posture is unchanged from 0005/0006: customers still have NO direct write
-- path to public.customers. The profile form goes through a SECURITY DEFINER RPC
-- granted to service_role only, exactly like claim_points and redeem_reward.

-- ---- customers: owner + pet profile ----
alter table public.customers
  add column if not exists date_of_birth        date,
  add column if not exists pet_name             text,
  add column if not exists pet_type             text,
  add column if not exists pet_dob              date,
  add column if not exists profile_completed_at timestamptz;

alter table public.customers drop constraint if exists customers_pet_type_check;
alter table public.customers
  add constraint customers_pet_type_check
  check (pet_type is null or pet_type in ('dog', 'cat', 'other'));

-- ---- rewards: shop catalog metadata ----
-- `category` is a free-text slug rather than an enum: the admin adds categories
-- without a migration, and the shop tab bar is built from the distinct values.
alter table public.rewards
  add column if not exists category             text,
  add column if not exists original_points_cost integer,
  add column if not exists is_exclusive         boolean not null default false,
  add column if not exists is_featured          boolean not null default false;

alter table public.rewards drop constraint if exists rewards_original_cost_check;
alter table public.rewards
  add constraint rewards_original_cost_check
  check (original_points_cost is null or original_points_cost >= points_cost);

create index if not exists rewards_category_idx
  on public.rewards (category) where is_active;

-- Only one reward can headline the shop; a partial unique index enforces it
-- instead of leaving the UI to pick arbitrarily among several.
create unique index if not exists rewards_one_featured
  on public.rewards ((true)) where is_featured and is_active;

-- ---- membership_tiers: structured perks ----
-- `benefits` (free text) stays for backward compat with the admin form; `perks`
-- is what the tier screen renders: [{"icon":"percent","title":"…","detail":"…"}]
alter table public.membership_tiers
  add column if not exists perks jsonb not null default '[]'::jsonb;

alter table public.membership_tiers drop constraint if exists membership_tiers_perks_check;
alter table public.membership_tiers
  add constraint membership_tiers_perks_check
  check (jsonb_typeof(perks) = 'array');

-- ---- support_requests ----
create table if not exists public.support_requests (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  name        text not null,
  email       text not null,
  topic       text not null,
  message     text not null,
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now()
);

create index if not exists support_requests_customer_idx
  on public.support_requests (customer_id, created_at desc);
create index if not exists support_requests_open_idx
  on public.support_requests (created_at desc) where status = 'open';

alter table public.support_requests enable row level security;

-- No customer INSERT policy on purpose: the Server Action inserts with the
-- service-role client after resolving customer_id from the session, so the
-- browser can never file a ticket against someone else's account.
drop policy if exists "read support requests"  on public.support_requests;
drop policy if exists "admin manage support requests" on public.support_requests;

create policy "read support requests"
  on public.support_requests for select to authenticated
  using (
    public.is_admin()
    or customer_id in (
      select c.id from public.customers c where c.auth_user_id = auth.uid()
    )
  );

create policy "admin manage support requests"
  on public.support_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- update_customer_profile ----
-- The ONLY write path for the profile screen. Touches profile columns only:
-- current_points, lifetime_points and tier_id are deliberately out of reach, so
-- even a compromised caller cannot mint points through it.
create or replace function public.update_customer_profile(
  p_customer_id uuid,
  p_full_name   text,
  p_dob         date,
  p_pet_name    text,
  p_pet_type    text,
  p_pet_dob     date
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers;
begin
  if p_pet_type is not null and p_pet_type not in ('dog', 'cat', 'other') then
    raise exception 'invalid pet type' using errcode = 'P0001';
  end if;

  update public.customers
     set full_name            = coalesce(nullif(trim(p_full_name), ''), full_name),
         date_of_birth        = p_dob,
         pet_name             = nullif(trim(p_pet_name), ''),
         pet_type             = p_pet_type,
         pet_dob              = p_pet_dob,
         -- First completed save wins; later edits must not reset the timestamp.
         profile_completed_at = coalesce(profile_completed_at, now()),
         updated_at           = now()
   where id = p_customer_id
   returning * into v_customer;

  if v_customer.id is null then
    raise exception 'customer not found' using errcode = 'P0001';
  end if;

  return json_build_object(
    'full_name',     v_customer.full_name,
    'date_of_birth', v_customer.date_of_birth,
    'pet_name',      v_customer.pet_name,
    'pet_type',      v_customer.pet_type,
    'pet_dob',       v_customer.pet_dob
  );
end;
$$;

revoke all on function public.update_customer_profile(uuid, text, date, text, text, date) from public, anon, authenticated;
grant execute on function public.update_customer_profile(uuid, text, date, text, text, date) to service_role;
