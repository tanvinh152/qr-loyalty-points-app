-- Loyalty & CRM schema.
-- Orders are NOT stored here: they live in Pancake POS and are fetched live at
-- claim time. Only the resulting ledger + customer state is persisted.
--
-- Tables: membership_tiers, product_points, rewards, customers, transactions,
--         loyalty_settings, claim_attempts

create extension if not exists pgcrypto;

drop table if exists public.point_transactions cascade;
drop table if exists public.point_settings    cascade;
drop table if exists public.orders            cascade;
drop table if exists public.customers         cascade;
drop function if exists public.claim_points(text, text, text, text);

-- Membership tiers. `threshold` is measured against lifetime_points; `multiplier`
-- scales every subsequent earn.
create table if not exists public.membership_tiers (
  id         uuid primary key default gen_random_uuid(),
  name       text    not null unique,
  threshold  integer not null unique check (threshold >= 0),
  multiplier numeric not null default 1 check (multiplier > 0),
  sort_order integer not null default 0,
  benefits   text,
  created_at timestamptz not null default now()
);

-- Points per Pancake SKU (`items[].variation_info.display_id`).
-- An unmapped SKU falls back to loyalty_settings.unmapped_sku_points.
create table if not exists public.product_points (
  id             uuid primary key default gen_random_uuid(),
  product_code   text    not null unique,
  label          text,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  is_active      boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- Reward store inventory.
create table if not exists public.rewards (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null,
  description text,
  points_cost integer not null check (points_cost >= 0),
  quantity    integer not null default 0 check (quantity >= 0),
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Customer identity keyed by phone. `auth_user_id` stays null until the customer
-- registers (Phase 4); the phone is the join key with claims made before signup.
create table if not exists public.customers (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid unique references auth.users(id) on delete set null,
  phone               text not null unique,
  email               text,
  full_name           text,
  pancake_customer_id text,
  current_points      integer not null default 0 check (current_points  >= 0),
  lifetime_points     integer not null default 0 check (lifetime_points >= 0),
  tier_id             uuid references public.membership_tiers(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists customers_pancake_idx on public.customers (pancake_customer_id);

-- Immutable ledger. EARN is positive, REDEEM negative, ADJUST either way.
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  phone       text not null,
  type        text not null check (type in ('EARN','REDEEM','ADJUST')),
  amount      integer not null,
  order_code  text,
  source      text not null default 'claim' check (source in ('claim','webhook','admin')),
  reward_id   uuid references public.rewards(id) on delete set null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

-- Idempotency: one ledger row per Pancake order, whichever path created it
-- (manual claim or webhook). REDEEM/ADJUST rows carry no order_code.
create unique index if not exists transactions_order_code_uniq
  on public.transactions (order_code) where order_code is not null;

create index if not exists transactions_customer_idx on public.transactions (customer_id, created_at desc);
create index if not exists transactions_phone_idx    on public.transactions (phone);

-- Global rules. Exactly one row may be active.
create table if not exists public.loyalty_settings (
  id                  uuid primary key default gen_random_uuid(),
  rounding            text    not null default 'floor' check (rounding in ('floor','round','ceil')),
  claimable_statuses  integer[] not null default '{3}',   -- Pancake status: 3 = delivered
  unmapped_sku_points integer not null default 0 check (unmapped_sku_points >= 0),
  is_active           boolean not null default false,
  updated_at          timestamptz not null default now()
);

create unique index if not exists loyalty_settings_one_active
  on public.loyalty_settings (is_active) where is_active;

-- Brute-force guard for /claim. Written via the service-role client only.
create table if not exists public.claim_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  order_code text,
  succeeded  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists claim_attempts_ip_idx
  on public.claim_attempts (ip, created_at desc);
create index if not exists claim_attempts_order_idx
  on public.claim_attempts (order_code, created_at desc);
