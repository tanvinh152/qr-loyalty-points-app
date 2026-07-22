-- Role split: admin vs customer.
--
-- Until now every authenticated user was an admin (see the NOTE in 0002_rls.sql).
-- Phase 4 puts real customers behind Supabase Auth, so "authenticated" is no
-- longer a synonym for "staff". The distinction is a JWT claim:
-- app_metadata.role = 'admin'. app_metadata is writable only with the service
-- role key, so a customer cannot self-promote (user_metadata could be edited by
-- the user and is therefore NOT used here).
--
-- Order matters: the backfill runs BEFORE the policies tighten, otherwise the
-- existing admin accounts lose access to everything the moment this applies.

-- ---- backfill: every pre-existing auth user is staff ----
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
 where coalesce(raw_app_meta_data ->> 'role', '') <> 'admin';

-- ---- claim helper ----
-- security definer + pinned search_path so a customer cannot shadow it.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role',
    ''
  ) = 'admin';
$$;

grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---- membership_tiers ----
drop policy if exists "anon read tiers"   on public.membership_tiers;
drop policy if exists "admin manage tiers" on public.membership_tiers;
create policy "read tiers"
  on public.membership_tiers for select to anon, authenticated using (true);
create policy "admin manage tiers"
  on public.membership_tiers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- rewards ----
-- Customers browse the store logged in, so the read policy covers both roles.
drop policy if exists "anon read active rewards" on public.rewards;
drop policy if exists "admin manage rewards"     on public.rewards;
create policy "read active rewards"
  on public.rewards for select to anon, authenticated using (is_active or public.is_admin());
create policy "admin manage rewards"
  on public.rewards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- loyalty_settings ----
drop policy if exists "anon read active settings" on public.loyalty_settings;
drop policy if exists "admin manage settings"     on public.loyalty_settings;
create policy "read active settings"
  on public.loyalty_settings for select to anon, authenticated using (is_active);
create policy "admin manage settings"
  on public.loyalty_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- product_points ----
-- Still not customer-readable: the SKU -> points map is business config.
drop policy if exists "admin manage product points" on public.product_points;
create policy "admin manage product points"
  on public.product_points for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- customers ----
-- Self-scoped read for the dashboard; admins keep the full view. No customer
-- write path: balances only ever move through the SECURITY DEFINER RPCs.
drop policy if exists "admin read customers"   on public.customers;
drop policy if exists "admin update customers" on public.customers;
create policy "customer reads own row"
  on public.customers for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());
create policy "admin update customers"
  on public.customers for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- transactions ----
drop policy if exists "admin read transactions" on public.transactions;
create policy "customer reads own transactions"
  on public.transactions for select to authenticated
  using (
    public.is_admin()
    or customer_id in (
      select c.id from public.customers c where c.auth_user_id = auth.uid()
    )
  );

-- ---- claim_attempts ----
drop policy if exists "admin read claim attempts" on public.claim_attempts;
create policy "admin read claim attempts"
  on public.claim_attempts for select to authenticated using (public.is_admin());
