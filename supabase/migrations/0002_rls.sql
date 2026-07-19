-- Row Level Security.
--
-- anon (customer portal, no login): read-only on public marketing data
--   (tiers, active rewards, active settings). Nothing else — no phone
--   enumeration, no ledger reads, no writes anywhere.
-- authenticated (admin): full read + write on config, read on CRM data.
-- All customer-facing writes go through the service-role client or a
--   SECURITY DEFINER RPC.
--
-- NOTE (Phase 4): when customer accounts land, add self-scoped policies here:
--   customers    for select to authenticated using (auth_user_id = auth.uid())
--   transactions for select to authenticated using (customer_id in (...))
-- and split admins from customers via a role claim, because today every
-- authenticated user is an admin.

alter table public.membership_tiers  enable row level security;
alter table public.product_points    enable row level security;
alter table public.rewards           enable row level security;
alter table public.customers         enable row level security;
alter table public.transactions      enable row level security;
alter table public.loyalty_settings  enable row level security;
alter table public.claim_attempts    enable row level security;

-- ---- membership_tiers ----
create policy "anon read tiers"
  on public.membership_tiers for select to anon using (true);
create policy "admin manage tiers"
  on public.membership_tiers for all to authenticated using (true) with check (true);

-- ---- rewards ----
create policy "anon read active rewards"
  on public.rewards for select to anon using (is_active);
create policy "admin manage rewards"
  on public.rewards for all to authenticated using (true) with check (true);

-- ---- loyalty_settings ----
create policy "anon read active settings"
  on public.loyalty_settings for select to anon using (is_active);
create policy "admin manage settings"
  on public.loyalty_settings for all to authenticated using (true) with check (true);

-- ---- product_points ----
-- Not anon-readable: the SKU->points map is business config, and the /claim
-- preview is computed server-side with the service-role client.
create policy "admin manage product points"
  on public.product_points for all to authenticated using (true) with check (true);

-- ---- customers ----
create policy "admin read customers"
  on public.customers for select to authenticated using (true);
create policy "admin update customers"
  on public.customers for update to authenticated using (true) with check (true);

-- ---- transactions ----
create policy "admin read transactions"
  on public.transactions for select to authenticated using (true);

-- ---- claim_attempts ----
create policy "admin read claim attempts"
  on public.claim_attempts for select to authenticated using (true);
