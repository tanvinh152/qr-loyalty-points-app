-- Brute-force guard for /admin/login. The admin account is the
-- highest-privilege login in the system, and until now it was the only auth
-- entry point with no throttle at all — src/lib/rate-limit.ts already does
-- this for the customer claim/signup flow via claim_attempts (0001), but that
-- table is scoped to order codes and its own comment says so, so this gets
-- its own table rather than overloading that one.
create table if not exists public.admin_login_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  succeeded  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_ip_idx
  on public.admin_login_attempts (ip, created_at desc);

alter table public.admin_login_attempts enable row level security;

drop policy if exists "admin read admin login attempts" on public.admin_login_attempts;
create policy "admin read admin login attempts"
  on public.admin_login_attempts for select to authenticated
  using (public.is_admin());

grant select on public.admin_login_attempts to authenticated;
