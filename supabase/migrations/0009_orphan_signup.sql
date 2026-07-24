-- Recovery for a half-finished signup.
--
-- signUp creates the auth user first and links it to a `customers` row a moment
-- later. If the process dies in between (or the customers row is removed by
-- hand), the phone's synthetic email alias stays taken forever: createUser keeps
-- answering "already been registered" and the customer can never register again
-- through any UI path.
--
-- This returns the auth user id ONLY when the account is provably one of those
-- corpses. The safety argument is the second condition: a real account ALWAYS
-- has a customers row, because linkAuthUserToPhone runs immediately after
-- createUser and rolls the user back when it fails. So a row-less auth user can
-- only be a dead signup, and adopting it grants nothing that finishing the
-- registration would not have granted anyway.
--
-- auth.users is not reachable through PostgREST, hence the RPC. Same posture as
-- claim_points / update_customer_profile: SECURITY DEFINER, service_role only.
-- The caller (signUp) has already passed the masked-phone ownership gate against
-- a real Pancake order before it gets here.
--
-- The last two conditions are belt-and-braces. Staff accounts have no customers
-- row either, so without them `admin@example.com` would look exactly like an
-- orphan. signUp can only ever ask about `phoneToEmail(phone)` — all digits at
-- the synthetic domain — so a staff address is unreachable in practice, but a
-- function that can hand back an admin's user id has no business existing.
-- The local part is matched rather than the domain because the domain is
-- configurable (CUSTOMER_EMAIL_DOMAIN) and the SQL must not drift from it.

create or replace function public.find_orphan_auth_user(p_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select u.id
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
     and not exists (
       select 1 from public.customers c where c.auth_user_id = u.id
     )
     and split_part(u.email, '@', 1) ~ '^[0-9]+$'
     and coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
   limit 1;
$$;

revoke all on function public.find_orphan_auth_user(text) from public, anon, authenticated;
grant execute on function public.find_orphan_auth_user(text) to service_role;
