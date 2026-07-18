-- Row Level Security.
-- anon (customer portal, no login): read-only on orders + point_settings, no writes anywhere.
--   All claim writes go through claim_points() RPC (SECURITY DEFINER), which bypasses RLS.
-- authenticated (admin): manage settings, read customers/transactions/orders.

alter table public.point_settings     enable row level security;
alter table public.orders             enable row level security;
alter table public.customers          enable row level security;
alter table public.point_transactions enable row level security;

-- ---- point_settings ----
create policy "anon read active settings"
  on public.point_settings for select
  to anon
  using (is_active);

create policy "admin read settings"
  on public.point_settings for select
  to authenticated
  using (true);

create policy "admin write settings"
  on public.point_settings for all
  to authenticated
  using (true) with check (true);

-- ---- orders ----
create policy "anon read orders"
  on public.orders for select
  to anon
  using (true);

create policy "admin read orders"
  on public.orders for select
  to authenticated
  using (true);
-- No anon/authenticated write policies: inserts/updates happen via service role
-- (webhook) or the claim_points RPC only.

-- ---- customers ----
-- No anon policies at all -> anon cannot read or write (prevents phone enumeration).
create policy "admin read customers"
  on public.customers for select
  to authenticated
  using (true);

-- ---- point_transactions ----
create policy "admin read transactions"
  on public.point_transactions for select
  to authenticated
  using (true);
