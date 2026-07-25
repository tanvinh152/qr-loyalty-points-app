-- Seed: tiers, active settings, a few real Pancake SKUs, sample rewards.
-- Orders are NOT seeded — they come from Pancake POS live.

-- Tier thresholds are LIFETIME SPEND in đồng, not points (see 0010_spend_tiers).
-- 0010 already writes this exact ladder so an existing database converges on it;
-- the same rows are repeated here so a fresh `db reset` reads as one story.
insert into public.membership_tiers (name, spend_threshold, multiplier, sort_order, benefits, perks) values
  ('Bạc',       0,        1.0, 1, 'Tích điểm mọi đơn hàng', '[
     {"icon":"percent","title":"Tích điểm mọi đơn","detail":"Áp dụng cho toàn bộ sản phẩm"}
   ]'::jsonb),
  ('Vàng',      3000000,  1.2, 2, 'Nhân 1.2 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.2×","detail":"Trên mọi đơn hàng"},
     {"icon":"gift","title":"Quà chào hạng","detail":"Voucher khi lên hạng Vàng"}
   ]'::jsonb),
  ('Bạch kim',  8000000,  1.5, 3, 'Nhân 1.5 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.5×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"3 mã mỗi tháng"}
   ]'::jsonb),
  ('Kim cương', 20000000, 1.8, 4, 'Nhân 1.8 điểm + quà sinh nhật', '[
     {"icon":"percent","title":"Tích điểm 1.8×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"Không giới hạn"},
     {"icon":"cake","title":"Quà sinh nhật","detail":"Voucher 10% + quà tặng"}
   ]'::jsonb),
  ('Ruby',      50000000, 2.0, 5, 'Nhân 2 điểm + đặc quyền cao nhất', '[
     {"icon":"percent","title":"Tích điểm 2×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"Không giới hạn"},
     {"icon":"cake","title":"Quà sinh nhật","detail":"Quà cao cấp cho bé cưng"},
     {"icon":"award","title":"Ưu tiên hỗ trợ","detail":"Đường dây riêng 24/7"}
   ]'::jsonb)
on conflict (name) do nothing;

insert into public.loyalty_settings (rounding, claimable_statuses, unmapped_sku_points, is_active)
-- 3 = delivered, 16 = received_money. Same set as the column default and as
-- DEFAULT_CLAIMABLE_STATUSES in src/lib/pancake/order-status.ts.
values ('floor', '{3,16}', 0, true)
on conflict do nothing;

-- Real SKUs from the shop (items[].variation_info.display_id).
insert into public.product_points (product_code, label, points_awarded) values
  ('SP000001',      'Cát sắn Chicha 2,5kg',     50),
  ('STPLCHODNC500', 'Sữa tắm Purodora 500ml',  100)
on conflict (product_code) do nothing;

-- `category` drives the shop's tab bar; at most one row may be is_featured.
insert into public.rewards
  (name, description, points_cost, quantity, category, is_exclusive, is_featured) values
  ('Voucher 50.000đ', 'Giảm 50.000đ cho đơn kế tiếp', 500,  100, 'Voucher',        false, false),
  ('Túi cát 2,5kg',   'Tặng 1 túi cát sắn Chicha',   1500, 20,  'Sản phẩm',       false, true),
  ('Combo chăm sóc',  'Bộ quà tặng thú cưng',        4000, 5,   'Phong cách sống', true,  false)
on conflict do nothing;
