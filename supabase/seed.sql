-- Seed: tiers, active settings, a few real Pancake SKUs, sample rewards.
-- Orders are NOT seeded — they come from Pancake POS live.

-- Tier thresholds are LIFETIME SPEND in đồng, not points (see 0010_spend_tiers).
-- These are the numbers from docs/Tich_Diem_ChiCha_Tong_Hop.md §8.2. 0010 wrote
-- an earlier placeholder ladder and 0023 corrects an existing database onto
-- these values, so the two paths converge and a fresh `db reset` reads as one
-- story. Keep this block and 0023 in step if the programme ever changes again.
-- Note there is no 0đ floor tier: under 1.000.000đ a member holds NO tier.
insert into public.membership_tiers (name, spend_threshold, multiplier, sort_order, benefits, perks) values
  ('Bạc',       1000000,  1.0, 1, 'Tích điểm mọi đơn hàng', '[
     {"icon":"percent","title":"Tích điểm mọi đơn","detail":"Áp dụng cho toàn bộ sản phẩm"}
   ]'::jsonb),
  ('Vàng',      2000000,  1.1, 2, 'Nhân 1.1 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.1×","detail":"Trên mọi đơn hàng"},
     {"icon":"gift","title":"Quà chào hạng","detail":"Voucher khi lên hạng Vàng"}
   ]'::jsonb),
  ('Bạch kim',  4000000,  1.2, 3, 'Nhân 1.2 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.2×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"3 mã mỗi tháng"}
   ]'::jsonb),
  ('Kim cương', 8000000,  1.4, 4, 'Nhân 1.4 điểm + quà sinh nhật', '[
     {"icon":"percent","title":"Tích điểm 1.4×","detail":"Trên mọi đơn hàng"},
     {"icon":"truck","title":"Miễn phí vận chuyển","detail":"Không giới hạn"},
     {"icon":"cake","title":"Quà sinh nhật","detail":"Voucher 10% + quà tặng"}
   ]'::jsonb),
  ('Ruby',      40000000, 2.0, 5, 'Nhân 2 điểm + đặc quyền cao nhất', '[
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

-- Spin wheel slices — same table, kind = 'spin' (0022). `weight` is relative,
-- not a percentage: the odds below are 20 / 8 / 1 / 40 / 6 out of 75. A 'gift'
-- slice is the only kind that spends `quantity`, and a sold-out one drops out
-- of the draw, so it needs real stock to ever be won. The wheel is still off
-- until an admin sets loyalty_settings.spin_daily_limit above zero.
insert into public.rewards
  (name, kind, points_cost, prize_type, points_amount, quantity, weight, sort_order) values
  ('50 điểm',                   'spin', 0, 'points', 50,   0,  20, 1),
  ('200 điểm',                  'spin', 0, 'points', 200,  0,   8, 2),
  ('1.000 điểm',                'spin', 0, 'points', 1000, 0,   1, 3),
  ('Chúc bạn may mắn lần sau',  'spin', 0, 'none',   0,    0,  40, 4),
  ('Túi cát sắn Chicha 2,5kg',  'spin', 0, 'gift',   0,    20,  6, 5)
on conflict do nothing;
