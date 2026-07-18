-- Schema: loyalty point app
-- Tables: point_settings, orders, customers, point_transactions

create extension if not exists pgcrypto;

-- Dynamic point-calculation config. Exactly one row may be active at a time.
create table if not exists public.point_settings (
  id               uuid primary key default gen_random_uuid(),
  conversion_rate  numeric not null default 1 check (conversion_rate >= 0),
  min_order_value  numeric not null default 0 check (min_order_value >= 0),
  rounding         text    not null default 'round' check (rounding in ('floor','round','ceil')),
  is_active        boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- Only one active settings row.
create unique index if not exists point_settings_one_active
  on public.point_settings (is_active) where is_active;

-- Orders. Mock-seeded now; synced via webhook later.
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_code        text not null unique,
  total             numeric not null check (total >= 0),
  status            text not null default 'pending' check (status in ('pending','claimed')),
  external_order_id text unique,           -- idempotency key for webhook sync
  created_at        timestamptz not null default now()
);

-- Customer identity + running points balance.
create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null unique,
  email        text,
  full_name    text,
  total_points integer not null default 0 check (total_points >= 0),
  created_at   timestamptz not null default now()
);

-- Immutable ledger of every claim.
create table if not exists public.point_transactions (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id    uuid not null references public.orders(id) on delete cascade,
  points      integer not null,
  created_at  timestamptz not null default now(),
  unique (order_id)   -- one ledger row per order
);

create index if not exists point_transactions_customer_idx
  on public.point_transactions (customer_id);
