-- Seed: tiers, active settings, a few real Pancake SKUs, sample rewards.
-- Orders are NOT seeded — they come from Pancake POS live.

-- Tier thresholds are LIFETIME SPEND in đồng, not points (see 0010_spend_tiers).
-- These are the numbers from docs/Tich_Diem_ChiCha.md §5.2. 0010 wrote an
-- earlier placeholder ladder and 0023 corrects an existing database onto these
-- values, so the two paths converge and a fresh `db reset` reads as one story.
-- Keep this block and 0023 in step if the programme ever changes again.
-- Note there is no 0đ floor tier: under 1.000.000đ a member holds NO tier.
--
-- `perks` mirrors the §5.2 benefit matrix EXACTLY, one entry per ticked row plus
-- the point multiplier. It replaces an earlier placeholder set ("Miễn phí vận
-- chuyển", "Ưu tiên hỗ trợ 24/7") that appears nowhere in the client spec.
--
-- ⚠️ THIS IS A PROGRAMME PROMISE, NOT A FEATURE LIST. Only three of these are
-- enforced by code today: the multiplier (claim_points), the daily wheel
-- (0022 — open to every tier, matching §5.2's row) and tier-gated gifts
-- (rewards.min_tier_id, 0017). The birthday perks, the collection, the care
-- combo and the new-product trials are fulfilled BY HAND at the shop. Publishing
-- them here is deliberate; do not read the list as something the system does.
insert into public.membership_tiers (name, spend_threshold, multiplier, sort_order, benefits, perks) values
  ('Bạc',       1000000,  1.0, 1, 'Tích điểm mọi đơn hàng', '[
     {"icon":"percent","title":"Tích điểm 1×","detail":"Trên mọi đơn hàng hợp lệ"},
     {"icon":"wheel","title":"Quay số mỗi ngày","detail":"Một lượt quay may mắn mỗi ngày"},
     {"icon":"cake","title":"Sinh nhật Sen","detail":"Lời chúc và voucher 50.000đ cho mỗi 1 triệu đã chi"},
     {"icon":"gift","title":"Quà đặc quyền","detail":"Những phần quà chỉ dành cho thành viên"}
   ]'::jsonb),
  ('Vàng',      2000000,  1.1, 2, 'Nhân 1.1 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.1×","detail":"Trên mọi đơn hàng hợp lệ"},
     {"icon":"wheel","title":"Quay số mỗi ngày","detail":"Một lượt quay may mắn mỗi ngày"},
     {"icon":"cake","title":"Sinh nhật Sen","detail":"Lời chúc và voucher 50.000đ cho mỗi 1 triệu đã chi"},
     {"icon":"paw","title":"Sinh nhật Boss","detail":"Nhân đôi điểm mọi đơn trong tuần sinh nhật bé cưng"},
     {"icon":"gift","title":"Quà đặc quyền","detail":"Những phần quà chỉ dành cho thành viên"}
   ]'::jsonb),
  ('Bạch kim',  4000000,  1.2, 3, 'Nhân 1.2 điểm mỗi đơn', '[
     {"icon":"percent","title":"Tích điểm 1.2×","detail":"Trên mọi đơn hàng hợp lệ"},
     {"icon":"wheel","title":"Quay số mỗi ngày","detail":"Một lượt quay may mắn mỗi ngày"},
     {"icon":"cake","title":"Sinh nhật Sen","detail":"Lời chúc và voucher 50.000đ cho mỗi 1 triệu đã chi"},
     {"icon":"paw","title":"Sinh nhật Boss","detail":"Nhân đôi điểm mọi đơn trong tuần sinh nhật bé cưng"},
     {"icon":"gift","title":"Quà đặc quyền","detail":"Những phần quà chỉ dành cho thành viên"}
   ]'::jsonb),
  ('Kim cương', 8000000,  1.4, 4, 'Nhân 1.4 điểm + trải nghiệm sản phẩm mới', '[
     {"icon":"percent","title":"Tích điểm 1.4×","detail":"Trên mọi đơn hàng hợp lệ"},
     {"icon":"wheel","title":"Quay số mỗi ngày","detail":"Một lượt quay may mắn mỗi ngày"},
     {"icon":"cake","title":"Sinh nhật Sen","detail":"Lời chúc và voucher 50.000đ cho mỗi 1 triệu đã chi"},
     {"icon":"paw","title":"Sinh nhật Boss","detail":"Nhân đôi điểm mọi đơn trong tuần sinh nhật bé cưng"},
     {"icon":"gift","title":"Quà đặc quyền","detail":"Những phần quà chỉ dành cho thành viên"},
     {"icon":"flask","title":"Trải nghiệm sản phẩm mới","detail":"Dùng thử trước khi sản phẩm ra mắt"}
   ]'::jsonb),
  ('Ruby',      40000000, 2.0, 5, 'Nhân 2 điểm + đặc quyền cao nhất', '[
     {"icon":"percent","title":"Tích điểm 2×","detail":"Trên mọi đơn hàng hợp lệ"},
     {"icon":"wheel","title":"Quay số mỗi ngày","detail":"Một lượt quay may mắn mỗi ngày"},
     {"icon":"cake","title":"Sinh nhật Sen","detail":"Lời chúc và voucher 50.000đ cho mỗi 1 triệu đã chi"},
     {"icon":"paw","title":"Sinh nhật Boss","detail":"Nhân đôi điểm mọi đơn trong tuần sinh nhật bé cưng"},
     {"icon":"gift","title":"Quà đặc quyền","detail":"Những phần quà chỉ dành cho thành viên"},
     {"icon":"flask","title":"Trải nghiệm sản phẩm mới","detail":"Dùng thử trước khi sản phẩm ra mắt"},
     {"icon":"layers","title":"Bộ sưu tập","detail":"Bộ sưu tập giới hạn dành riêng hạng Ruby"},
     {"icon":"heart","title":"Combo chăm sóc","detail":"Gói chăm sóc trị giá 1.000.000đ"}
   ]'::jsonb)
on conflict (name) do nothing;

-- 3 = delivered, 16 = received_money. Same set as the column default and as
-- DEFAULT_CLAIMABLE_STATUSES in src/lib/pancake/order-status.ts.
--
-- vnd_per_point = 1000 is §5.1: `1.000 VNĐ chi tiêu thực = 1 điểm`. The per-SKU
-- product_points table this file used to seed was dropped in 0025.
insert into public.loyalty_settings (rounding, claimable_statuses, vnd_per_point, is_active)
values ('floor', '{3,16}', 1000, true)
on conflict do nothing;

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

-- Spend milestones — same table again, kind = 'milestone' (0024). An
-- INDEPENDENT ladder from the tiers: measured in đồng of lifetime_spend, but
-- passing a rung moves no tier.
--
-- These are the rungs from §4.2 of docs/Tich_Diem_ChiCha.md, NOT the
-- ones drawn in the remix mockup — the mockup's ladder (800k / 3.2tr / 5.5tr /
-- 8tr) does not match the spec's, and the spec is the contract. See item 5 in
-- the plan's open questions: the client still has to confirm the final numbers.
--
-- Every inert column is stamped explicitly, exactly as saveMilestone does:
-- rewards_milestone_fields_check pins them all to zero.
insert into public.rewards
  (name, description, kind, points_cost, quantity, spend_threshold) values
  ('Súp/Pate',        'Quà tặng tại mốc 400.000đ',            'milestone', 0, 0,   400000),
  ('Voucher 20.000đ', 'Giảm giá trực tiếp cho đơn hàng',      'milestone', 0, 0,   800000),
  ('Voucher 30.000đ', 'Áp dụng cho mọi sản phẩm',             'milestone', 0, 0,  1200000),
  ('Voucher 50.000đ', 'Quà tặng tại mốc 2.000.000đ',          'milestone', 0, 0,  2000000),
  ('1 Túi cát',       'Túi cát sắn Chicha 2,5kg',             'milestone', 0, 0,  3200000),
  ('Set Quà Lvl 1',   'Bộ quà tặng khi đạt hạng Bạch Kim',    'milestone', 0, 0,  5100000),
  ('Set Quà Lvl 2',   'Bộ quà tặng khi đạt hạng Kim Cương',   'milestone', 0, 0,  8350000)
on conflict do nothing;
