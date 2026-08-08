-- Silver-tier welcome gift.
--
-- "Bạc" is the 0đ floor tier every customer already holds the moment their
-- first claim lands (see 0010/0011), so this is really a one-time points
-- grant on successful registration, amount set by the admin. 0 (the column
-- default) means the feature is off.
--
-- One transaction row per customer, guarded by a partial unique index rather
-- than a separate grants table — same ledger-is-the-audit-trail approach as
-- every other balance movement in this schema.

alter table public.loyalty_settings
  add column if not exists welcome_gift_points integer not null default 0
    check (welcome_gift_points >= 0);

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('claim', 'webhook', 'admin', 'redeem', 'welcome'));

create unique index if not exists transactions_welcome_once_idx
  on public.transactions (customer_id) where source = 'welcome';

create or replace function public.grant_welcome_gift(
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
begin
  select * into v_customer from public.customers where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found' using errcode = 'P0001';
  end if;

  select * into v_settings from public.loyalty_settings where is_active limit 1;
  if v_settings.id is null then
    raise exception 'no active loyalty settings' using errcode = 'P0004';
  end if;

  -- Off, or already granted (transactions_welcome_once_idx) -> a no-op, not an
  -- error: callers must be able to call this unconditionally on every signup.
  if v_settings.welcome_gift_points <= 0 then
    return json_build_object('granted', false, 'points_awarded', 0,
                              'current_points', v_customer.current_points);
  end if;

  begin
    insert into public.transactions (customer_id, phone, type, amount, order_code, source, meta)
    values (v_customer.id, v_customer.phone, 'EARN', v_settings.welcome_gift_points, null, 'welcome',
            jsonb_build_object('reason', 'signup welcome gift'));
  exception when unique_violation then
    return json_build_object('granted', false, 'points_awarded', 0,
                              'current_points', v_customer.current_points);
  end;

  update public.customers
     set current_points  = current_points  + v_settings.welcome_gift_points,
         lifetime_points = lifetime_points + v_settings.welcome_gift_points,
         updated_at      = now()
   where id = v_customer.id
  returning * into v_customer;

  return json_build_object(
    'granted',        true,
    'points_awarded',  v_settings.welcome_gift_points,
    'current_points',  v_customer.current_points
  );
end;
$$;

revoke all on function public.grant_welcome_gift(uuid) from public, anon, authenticated;
grant execute on function public.grant_welcome_gift(uuid) to service_role;
