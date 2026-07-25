-- The auth identity becomes the member's REAL email.
--
-- Until now `auth.users.email` held a synthetic alias built from the phone
-- (`phoneToEmail`, `<digits>@customer.chicha-label.app`) and `customers.email`
-- was always NULL. Signup now demands a real address, writes it to BOTH, and
-- sign-in resolves phone -> customers.email before handing it to Supabase.
-- Two things in 0009/0001 assumed the old shape.

-- 1. Re-key the orphan lookup.
--
-- 0009's rationale still holds in full: a signup that died between createUser
-- and linkAuthUserToPhone leaves an auth user with no `customers` row, and
-- without a way to adopt it the member could never register again. Only the KEY
-- changes. The old function found the corpse by email and proved it was one of
-- ours with `split_part(u.email,'@','1') ~ '^[0-9]+$'` — the local part is all
-- digits — which is exactly the synthetic-alias assumption, now false.
--
-- Matching on the email would also be the wrong question: a member retrying
-- after a failed attempt may type a corrected address, and the corpse would be
-- invisible. The phone is what the order code proved, what `customers.phone`
-- is unique on, and what createUser already stores in user_metadata, so it is
-- the identity to look up by.
--
-- The safety argument is unchanged and does not depend on the key: a real
-- account ALWAYS has a customers row, so a row-less auth user can only be a dead
-- signup, and adopting it grants nothing that finishing the registration would
-- not have granted anyway. The admin exclusion stays for the same
-- belt-and-braces reason — staff have no customers row either, and a function
-- that can hand back an admin's user id has no business existing. Staff are also
-- unreachable in practice now for a different reason than in 0009: they are
-- created without a `phone` in user_metadata.
--
-- The parameter is renamed, which CREATE OR REPLACE cannot do.
drop function if exists public.find_orphan_auth_user(text);

create or replace function public.find_orphan_auth_user(p_phone text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select u.id
    from auth.users u
   where u.raw_user_meta_data ->> 'phone' = trim(p_phone)
     and not exists (
       select 1 from public.customers c where c.auth_user_id = u.id
     )
     and coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
   limit 1;
$$;

revoke all on function public.find_orphan_auth_user(text) from public, anon, authenticated;
grant execute on function public.find_orphan_auth_user(text) to service_role;

-- 2. One address, one account.
--
-- `auth.users.email` is already unique; this keeps `customers.email` from
-- drifting into a state auth would refuse. Case-insensitive because a mailbox
-- is: signup lower-cases before writing (makeCustomerSignupSchema), and this
-- index is what catches anything that does not.
--
-- Deliberately PARTIAL over a still-nullable column rather than NOT NULL:
-- `claim_points` inserts `customers` rows with `p_email` allowed to be null, and
-- `linkAuthUserToPhone` exists precisely because a webhook may have created the
-- row before the member ever signed up. NOT NULL would make those paths throw.
-- "Required" is enforced at signup, where the address actually comes from.
create unique index if not exists customers_email_idx
  on public.customers (lower(email))
  where email is not null;
