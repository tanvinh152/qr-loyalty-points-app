-- Seed: one active settings row + mock pending orders to unblock frontend.

insert into public.point_settings (conversion_rate, min_order_value, rounding, is_active)
values (0.1, 50000, 'floor', true)
on conflict do nothing;

insert into public.orders (order_code, total, status) values
  ('ORD-1001', 120000, 'pending'),
  ('ORD-1002',  45000, 'pending'),   -- below min_order_value -> 0 points
  ('ORD-1003', 300000, 'pending'),
  ('ORD-1004',  99000, 'pending'),
  ('ORD-2001', 250000, 'claimed')    -- already claimed, for double-claim test
on conflict (order_code) do nothing;
