-- Seed: tiers, active settings, a few real Pancake SKUs, sample rewards.
-- Orders are NOT seeded — they come from Pancake POS live.

insert into public.membership_tiers (name, threshold, multiplier, sort_order, benefits) values
  ('Thành viên', 0,    1.0, 1, 'Tích điểm mọi đơn hàng'),
  ('Bạc',        500,  1.2, 2, 'Nhân 1.2 điểm mỗi đơn'),
  ('Vàng',       2000, 1.5, 3, 'Nhân 1.5 điểm mỗi đơn'),
  ('Kim cương',  5000, 2.0, 4, 'Nhân 2 điểm + quà sinh nhật')
on conflict (name) do nothing;

insert into public.loyalty_settings (rounding, claimable_statuses, unmapped_sku_points, is_active)
values ('floor', '{3}', 0, true)
on conflict do nothing;

-- Real SKUs from the shop (items[].variation_info.display_id).
insert into public.product_points (product_code, label, points_awarded) values
  ('SP000001',      'Cát sắn Chicha 2,5kg',     50),
  ('STPLCHODNC500', 'Sữa tắm Purodora 500ml',  100)
on conflict (product_code) do nothing;

insert into public.rewards (name, description, points_cost, quantity) values
  ('Voucher 50.000đ', 'Giảm 50.000đ cho đơn kế tiếp', 500,  100),
  ('Túi cát 2,5kg',   'Tặng 1 túi cát sắn Chicha',   1500, 20),
  ('Combo chăm sóc',  'Bộ quà tặng thú cưng',        4000, 5)
on conflict do nothing;
