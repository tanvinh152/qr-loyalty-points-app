-- Daily check-in points — a new earning path, entirely independent of
-- claim_points/Pancake orders. Fixed points per day, admin-configured amount,
-- at most once per calendar day in Vietnam's timezone (the app's only market).

alter table public.loyalty_settings
  add column if not exists checkin_points integer not null default 0
    check (checkin_points >= 0);

create table if not exists public.customer_checkins (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers(id) on delete cascade,
  checkin_date   date not null,
  points_awarded integer not null,
  created_at     timestamptz not null default now()
);

-- The idempotency guard: one row per customer per day, so a double-click or a
-- retried request can never award twice.
create unique index if not exists customer_checkins_once_per_day_idx
  on public.customer_checkins (customer_id, checkin_date);

create index if not exists customer_checkins_customer_idx
  on public.customer_checkins (customer_id, checkin_date desc);

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('claim', 'webhook', 'admin', 'redeem', 'welcome', 'checkin'));

alter table public.customer_checkins enable row level security;

drop policy if exists "admin read checkins" on public.customer_checkins;
create policy "admin read checkins"
  on public.customer_checkins for select to authenticated
  using (public.is_admin());

drop policy if exists "read own checkins" on public.customer_checkins;
create policy "read own checkins"
  on public.customer_checkins for select to authenticated
  using (
    public.is_admin()
    or customer_id in (
      select c.id from public.customers c where c.auth_user_id = auth.uid()
    )
  );

grant select on public.customer_checkins to authenticated;

create or replace function public.checkin(
  p_customer_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.loyalty_settings;
  v_customer public.customers;
  v_date     date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  select * into v_customer from public.customers where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found' using errcode = 'P0001';
  end if;

  select * into v_settings from public.loyalty_settings where is_active limit 1;
  if v_settings.id is null then
    raise exception 'no active loyalty settings' using errcode = 'P0004';
  end if;

  if v_settings.checkin_points <= 0 then
    raise exception 'checkin disabled' using errcode = 'P0005';
  end if;

  begin
    insert into public.customer_checkins (customer_id, checkin_date, points_awarded)
    values (v_customer.id, v_date, v_settings.checkin_points);
  exception when unique_violation then
    raise exception 'already checked in today' using errcode = 'P0002';
  end;

  insert into public.transactions (customer_id, phone, type, amount, order_code, source, meta)
  values (v_customer.id, v_customer.phone, 'EARN', v_settings.checkin_points, null, 'checkin',
          jsonb_build_object('checkin_date', v_date));

  update public.customers
     set current_points  = current_points  + v_settings.checkin_points,
         lifetime_points = lifetime_points + v_settings.checkin_points,
         updated_at      = now()
   where id = v_customer.id
  returning * into v_customer;

  return json_build_object(
    'points_awarded', v_settings.checkin_points,
    'current_points', v_customer.current_points,
    'checkin_date',   v_date
  );
end;
$$;

revoke all on function public.checkin(uuid) from public, anon, authenticated;
grant execute on function public.checkin(uuid) to service_role;
