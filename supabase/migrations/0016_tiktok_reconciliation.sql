-- TikTok order money reconciliation.
--
-- Pancake syncs TikTok Shop orders' final total 4-6 days after the order first
-- lands, so the total_price/total_price_after_sub_discount the webhook claims
-- against can be wrong at claim time. Points themselves are unaffected — they
-- are computed per-SKU from product_points, never from the order total — but
-- `p_order_total` feeds `customers.lifetime_spend`, which is what the tier
-- ladder is measured against (0010), so a wrong total can under- or
-- over-credit spend and therefore tier progress.
--
-- The webhook (application code) enqueues a row here for every claimed order
-- whose `order_sources_name` looks like TikTok; a cron re-fetches the order
-- after `reconcile_after` and calls reconcile_order_spend below.
--
-- No new transaction row and no relaxed uniqueness on transactions.order_code:
-- 0011's comment on the EARN row ("order_total is on the row so a spend total
-- can be rebuilt or reconciled from the ledger alone") already anticipated
-- this — reconciliation UPDATEs that same row's meta.order_total in place.

create table if not exists public.pending_order_reconciliations (
  id              uuid primary key default gen_random_uuid(),
  order_code      text not null unique,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  source_name     text not null,
  claimed_total   numeric(14,0) not null,
  claimed_at      timestamptz not null default now(),
  reconcile_after timestamptz not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'reconciled', 'unchanged', 'failed')),
  reconciled_at   timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists pending_reconciliations_due_idx
  on public.pending_order_reconciliations (reconcile_after)
  where status = 'pending';

alter table public.pending_order_reconciliations enable row level security;

drop policy if exists "admin manage pending reconciliations" on public.pending_order_reconciliations;
create policy "admin manage pending reconciliations"
  on public.pending_order_reconciliations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.pending_order_reconciliations to authenticated;

-- ---- reconcile_order_spend ----
--
-- Re-prices the EARN row an order already claimed and applies the delta to
-- lifetime_spend. Tier is sticky and only ever rises (0010): a correction can
-- newly qualify an upgrade the original (wrong) total missed, but a lower
-- corrected total can never take a tier away.
create or replace function public.reconcile_order_spend(
  p_order_code text,
  p_new_total  numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn       public.transactions;
  v_customer  public.customers;
  v_old_total numeric;
  v_new_total numeric;
  v_delta     numeric;
  v_old_thr   numeric;
  v_new_tier  uuid;
  v_new_thr   numeric;
  v_upgraded  boolean := false;
  v_tier_name text;
begin
  if p_order_code is null or length(trim(p_order_code)) = 0 then
    raise exception 'order_code required' using errcode = 'P0001';
  end if;

  select * into v_txn from public.transactions
   where order_code = p_order_code and type = 'EARN'
   for update;

  if v_txn.id is null then
    raise exception 'no earn transaction for order' using errcode = 'P0001';
  end if;

  select * into v_customer from public.customers where id = v_txn.customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found' using errcode = 'P0001';
  end if;

  v_old_total := coalesce((v_txn.meta ->> 'order_total')::numeric, 0);
  v_new_total := greatest(coalesce(p_new_total, 0), 0);
  v_delta     := v_new_total - v_old_total;

  if v_delta <> 0 then
    update public.transactions
       set meta = coalesce(meta, '{}'::jsonb)
                  || jsonb_build_object('order_total', v_new_total, 'reconciled_at', now())
     where id = v_txn.id;

    update public.customers
       set lifetime_spend = greatest(lifetime_spend + v_delta, 0),
           updated_at     = now()
     where id = v_customer.id
    returning * into v_customer;
  end if;

  select t.spend_threshold into v_old_thr
    from public.membership_tiers t where t.id = v_customer.tier_id;

  select t.id, t.spend_threshold into v_new_tier, v_new_thr
    from public.membership_tiers t
   where t.spend_threshold <= v_customer.lifetime_spend
   order by t.spend_threshold desc
   limit 1;

  if v_new_tier is not null and (v_old_thr is null or v_new_thr > v_old_thr) then
    v_upgraded := true;

    update public.customers set tier_id = v_new_tier, updated_at = now()
     where id = v_customer.id
    returning * into v_customer;

    select t.name into v_tier_name from public.membership_tiers t where t.id = v_new_tier;

    insert into public.customer_tier_history
      (customer_id, tier_id, tier_name, threshold_amount, spend_at_award, source)
    values (v_customer.id, v_new_tier, coalesce(v_tier_name, ''), v_new_thr,
            v_customer.lifetime_spend, 'webhook');
  end if;

  return json_build_object(
    'order_code',     p_order_code,
    'old_total',      v_old_total,
    'new_total',      v_new_total,
    'delta',          v_delta,
    'lifetime_spend', v_customer.lifetime_spend,
    'tier_upgraded',  v_upgraded
  );
end;
$$;

revoke all on function public.reconcile_order_spend(text, numeric)
  from public, anon, authenticated;
grant execute on function public.reconcile_order_spend(text, numeric) to service_role;
