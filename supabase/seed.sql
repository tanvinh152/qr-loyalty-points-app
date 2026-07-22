-- Seed: tiers, active settings, a few real Pancake SKUs, sample rewards.
-- Orders are NOT seeded — they come from Pancake POS live.

insert into public.membership_tiers (name, threshold, multiplier, sort_order, benefits, perks) values
  ('Thành viên', 0,    1.0, 1, 'Tích điểm mọi đơn hàng', '[
     {"icon":"percent","title":"Tích điểm mọi đơn","detail":"Áp dụng cho toàn bộ sản phẩm"}
   ]'::jsonb),
  ('Bạc',        500,  1.2, 2, 'Nhân 1.2 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.2×","detail":"Trên mọi đơn hàng"},
     {"icon":"gift","title":"Quà chào hạng","detail":"Voucher khi lên hạng Bạc"}
   ]'::jsonb),
  ('Vàng',       2000, 1.5, 3, 'Nhân 1.5 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.5×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"3 mã mỗi tháng"},
     {"icon":"cake","title":"Quà sinh nhật","detail":"Voucher 10% + quà tặng"}
   ]'::jsonb),
  ('Kim cương',  5000, 2.0, 4, 'Nhân 2 điểm + quà sinh nhật', '[
     {"icon":"percent","title":"Tích điểm 2×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"Không giới hạn"},
     {"icon":"cake","title":"Quà sinh nhật","detail":"Quà cao cấp cho bé cưng"},
     {"icon":"award","title":"Ưu tiên hỗ trợ","detail":"Đường dây riêng 24/7"}
   ]'::jsonb)
on conflict (name) do nothing;

insert into public.loyalty_settings (rounding, claimable_statuses, unmapped_sku_points, is_active)
values ('floor', '{3}', 0, true)
on conflict do nothing;

-- Real SKUs from the shop (items[].variation_info.display_id).
insert into public.product_points (product_code, label, points_awarded) values
  ('SP000001',      'Cát sắn Chicha 2,5kg',     50),
  ('STPLCHODNC500', 'Sữa tắm Purodora 500ml',  100)
on conflict (product_code) do nothing;

-- `category` drives the shop's tab bar; at most one row may be is_featured.
insert into public.rewards
  (name, description, points_cost, original_points_cost, quantity, category, is_exclusive, is_featured) values
  ('Voucher 50.000đ', 'Giảm 50.000đ cho đơn kế tiếp', 500,  null, 100, 'Voucher',        false, false),
  ('Túi cát 2,5kg',   'Tặng 1 túi cát sắn Chicha',   1500, 1800, 20,  'Sản phẩm',       false, true),
  ('Combo chăm sóc',  'Bộ quà tặng thú cưng',        4000, null, 5,   'Phong cách sống', true,  false)
on conflict do nothing;
