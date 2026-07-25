# Bộ test case thủ công — Customer & Admin

Checklist QA bấm tay cho toàn bộ 2 portal. Rút từ code, không phải từ mô tả tính năng —
mỗi case ghi rõ file/hàm nguồn để dev đối chiếu khi case fail.

- **ID**: `<C|A|S>-<NHÓM>-<số>` — `C` = customer, `A` = admin, `S` = hệ thống (webhook / cron / phân quyền / i18n / theme).
- **Ưu tiên**: `P0` chặn release (tiền, điểm, phân quyền) · `P1` chức năng chính · `P2` hiển thị / phụ.

---

## 1. Tiền điều kiện chung

| Mục | Giá trị |
|-----|---------|
| Reset DB | `supabase db reset` (chạy hết `supabase/migrations/*.sql` + `supabase/seed.sql`) |
| Chạy app | `npm run dev` |
| Tài khoản test | Xem `docs/account-test.md` — admin `admin@gmail.com/admin`, customer `0376733152/123123123` |
| Env Pancake | `PANCAKE_*` trỏ tới shop thật (đơn hàng KHÔNG được seed, luôn fetch live) |
| Env webhook | `WEBHOOK_SECRET` — dùng chung cho `/api/webhooks/pancake` và `/api/cron/tier-schedules` |
| Dữ liệu cần chuẩn bị tay | ≥ 3 mã đơn Pancake thật: (a) đơn chưa ai đăng ký, status 3 hoặc 16; (b) đơn đã thuộc tài khoản khác; (c) đơn status khác 3/16 |

> Tài khoản admin phải có `app_metadata.role = 'admin'` (xem `public.is_admin()` ở `0005_roles_and_customer_rls.sql`).
> Tài khoản customer **không bao giờ** được có claim này.

### 1.1. Dữ liệu seed tham chiếu

**Hạng thành viên** (`spend_threshold` là **chi tiêu tích luỹ tính bằng đồng**, KHÔNG phải điểm):

| Hạng | Mốc chi tiêu | Hệ số nhân điểm | sort_order |
|------|-------------|-----------------|------------|
| Bạc | 0đ | ×1.0 | 1 |
| Vàng | 3.000.000đ | ×1.2 | 2 |
| Bạch kim | 8.000.000đ | ×1.5 | 3 |
| Kim cương | 20.000.000đ | ×1.8 | 4 |
| Ruby | 50.000.000đ | ×2.0 | 5 |

**Cấu hình loyalty**: `rounding = floor` · `claimable_statuses = {3, 16}` · `unmapped_sku_points = 0`

**SKU đã map**: `SP000001` = 50 điểm · `STPLCHODNC500` = 100 điểm. SKU khác → 0 điểm (fallback).

**Quà**: Voucher 50.000đ — 500 điểm / 100 cái · Túi cát 2,5kg — 1500 điểm / 20 cái (**nổi bật**) ·
Combo chăm sóc — 4000 điểm / 5 cái (**exclusive**).

### 1.2. Công thức điểm (chỉ tồn tại trong RPC `claim_points`, `0011_claim_spend.sql`)

```
điểm = floor( Σ(qty × points_awarded của SKU) × hệ_số_nhân_của_hạng_ĐANG_GIỮ )
```

Hệ số nhân lấy từ hạng khách **đang giữ lúc đơn về**, không phải hạng sau khi cộng.
`lifetime_spend` cộng thêm `p_order_total`; hạng chỉ được **nâng**, không bao giờ tụt.

---

## 2. Customer — Đăng ký (C-REG)

Nguồn: `src/app/(customer)/auth/actions.ts` → `signUp` · schema `makeCustomerSignupSchema` (`src/lib/schemas.ts:81`)

Form `/register` gồm: họ tên, ngày sinh, SĐT, email, mật khẩu, mã đơn hàng, checkbox điều khoản.
**Không có màn hình claim điểm thủ công** — đăng ký chính là bước liên kết tài khoản với POS.

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| C-REG-01 | Mã đơn (a) hợp lệ, status 3/16, SĐT khớp đơn, SĐT + email chưa đăng ký | Điền đủ form → Đăng ký | Chuyển sang `/dashboard`; tài khoản tạo; `customers.pancake_customer_id` đã ghi; điểm của đơn đã cộng; giao dịch `EARN` xuất hiện ở `/history` | P0 |
| C-REG-02 | Như C-REG-01 nhưng đơn status **khác** 3/16 (VD status 0) | Đăng ký | Vẫn tạo tài khoản + liên kết thành công, nhưng **điểm = 0**; đơn sẽ được cộng sau qua webhook khi đổi status | P0 |
| C-REG-03 | Sau C-REG-01 | Mở Pancake, xem hồ sơ khách | Tên thật + SĐT thật đã được đẩy lên POS (chỉ ghi đè chỗ POS đang là mask; nếu POS đã có đủ thì bỏ qua) | P1 |
| C-REG-04 | Mã đơn không tồn tại | Nhập mã bậy → Đăng ký | `"Mã đơn hàng không khớp với số điện thoại này."`; **không** tạo auth user; bị trừ 1 lượt rate limit | P0 |
| C-REG-05 | Đơn tồn tại nhưng SĐT nhập **không** khớp SĐT trên đơn | Đăng ký | Cùng một thông báo `"Mã đơn hàng không khớp với số điện thoại này."` — **không được** khác với C-REG-04 (khác nhau sẽ lộ đơn nào tồn tại) | P0 |
| C-REG-06 | Đơn không có `customer.customer_id` | Đăng ký | `"Đơn hàng này chưa có hồ sơ khách hàng trên hệ thống cửa hàng…"`; không tạo tài khoản | P0 |
| C-REG-07 | Đơn (b) — POS customer đã link tài khoản khác | Đăng ký bằng SĐT khác | `"Đơn hàng này đã thuộc về một tài khoản thành viên…"`; **kiểm tra `auth.users` không còn user rác nào của lần thử này** | P0 |
| C-REG-08 | Email đã dùng cho tài khoản khác, SĐT mới | Đăng ký | `"Email này đã được dùng cho một tài khoản khác."` | P0 |
| C-REG-09 | SĐT đã có tài khoản, email mới, mã đơn hợp lệ | Đăng ký | `"Số điện thoại này đã được đăng ký."`; auth user vừa tạo bị xoá lại (rollback) | P0 |
| C-REG-10 | Tắt Pancake / đổi `PANCAKE_API_KEY` sang key sai | Đăng ký với mã đơn bất kỳ | `"Hệ thống đang gặp sự cố. Vui lòng thử lại sau vài phút."`; **KHÔNG** bị trừ lượt rate limit (kiểm bảng `claim_attempts` không có dòng mới) | P0 |
| C-REG-11 | Tài khoản mồ côi: có `auth.users` nhưng không có dòng `public.customers` cho SĐT đó | Đăng ký lại đúng SĐT đó (có thể đổi email) | Nhận lại (adopt) auth user cũ, đăng ký thành công — không kẹt vĩnh viễn ở "SĐT đã đăng ký" (`find_orphan_auth_user`, `0009`) | P0 |
| C-REG-12 | — | Nhập SĐT `+84376733152`, rồi `84376733152`, rồi `0376733152` | Cả ba chuẩn hoá về `0376733152` → chỉ tạo được **một** tài khoản, hai lần sau báo SĐT đã đăng ký | P0 |
| C-REG-13 | — | Nhập SĐT không hợp lệ (`0123`, `abc`) | `"Số điện thoại không hợp lệ"` — chặn ở client, không gọi server | P1 |
| C-REG-14 | — | Mật khẩu 7 ký tự | `"Mật khẩu phải có ít nhất 8 ký tự"` | P1 |
| C-REG-15 | — | Email sai định dạng (`a@`, `abc`) | `"Email không hợp lệ"` | P1 |
| C-REG-16 | — | Bỏ trống ngày sinh / nhập sai định dạng | `"Ngày không hợp lệ"` | P1 |
| C-REG-17 | — | Không tick điều khoản → Đăng ký | `"Vui lòng đồng ý với điều khoản để tiếp tục"` | P1 |
| C-REG-18 | — | Bỏ trống mã đơn | `"Vui lòng nhập mã đơn hàng"` | P1 |
| C-REG-19 | Đơn dùng cả 2 định danh: `system_id` (số ngắn) và `id` (chuỗi marketplace) | Đăng ký lần lượt bằng từng định danh (2 tài khoản, 2 đơn khác nhau) | Cả hai đều nhận; `transactions.order_code` luôn lưu **`id` chuẩn** chứ không phải cái người dùng gõ | P1 |
| C-REG-20 | Đăng ký xong C-REG-01, chưa từng bấm nút đổi giao diện | Kiểm tra giao diện sau khi vào dashboard | Ngày sinh ≥ 30 tuổi → theme **sáng**; < 30 tuổi → theme **tối** (`themeForDob`, `LIGHT_THEME_MIN_AGE = 30`) | P2 |

---

## 3. Customer — Đăng nhập / đăng xuất (C-LOG)

Nguồn: `signIn` / `signOut` (`src/app/(customer)/auth/actions.ts:63`)

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| C-LOG-01 | Tài khoản `0376733152/123123123` | `/login` → nhập SĐT + mật khẩu | Vào `/dashboard` | P0 |
| C-LOG-02 | — | SĐT đúng, mật khẩu sai | `"Số điện thoại hoặc mật khẩu không đúng."` | P0 |
| C-LOG-03 | — | SĐT **chưa hề** đăng ký | Cùng thông báo với C-LOG-02, cùng thời gian phản hồi tương đương — không được lộ SĐT nào là thành viên | P0 |
| C-LOG-04 | — | Nhập `+84376733152` thay vì `0376733152` | Vẫn đăng nhập được (chuẩn hoá trước khi tra `customers.email`) | P1 |
| C-LOG-05 | Đã đăng nhập | Vào lại `/login` hoặc `/register` | Bị chuyển về `/dashboard` | P1 |
| C-LOG-06 | Đã đăng nhập, đã tự bấm đổi theme sang tối | Đăng xuất → đăng nhập lại | Theme tối **được giữ** — không bị ghi đè bởi mặc định theo tuổi | P1 |
| C-LOG-07 | Đã đăng nhập | Bấm Đăng xuất | Về `/login`; quay lại `/dashboard` bị chặn về `/login` | P0 |
| C-LOG-08 | — | Bỏ trống mật khẩu | `"Mật khẩu phải có ít nhất 8 ký tự"` | P2 |

---

## 4. Customer — Dashboard (C-DASH)

Nguồn: `src/app/(customer)/(account)/dashboard/page.tsx` · `tierProgress` (`src/lib/loyalty.ts:577`)

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| C-DASH-01 | Khách có điểm + giao dịch | Mở `/dashboard` | Hiện đúng: điểm hiện tại, điểm tích luỹ, chi tiêu tích luỹ, tên hạng | P0 |
| C-DASH-02 | Khách chi tiêu 3.500.000đ (hạng Vàng) | Mở `/dashboard` | Thanh tiến trình tính **trong dải hạng hiện tại**: đáy = 3.000.000đ (Vàng), đích = 8.000.000đ (Bạch kim) → 10%. KHÔNG tính từ 0đ | P0 |
| C-DASH-03 | Khách ở hạng Ruby (cao nhất) | Mở `/dashboard` | Thanh đầy 100%, không hiện "còn thiếu X đ" | P1 |
| C-DASH-04 | Khách 0 giao dịch | Mở `/dashboard` | Hiện empty state, không lỗi | P1 |
| C-DASH-05 | Khách có > 5 giao dịch | Mở `/dashboard` | Khối "gần đây" chỉ hiện 5 dòng mới nhất | P2 |
| C-DASH-06 | Khách có 300 điểm | Mở `/dashboard` | Gợi ý quà kế tiếp = quà **rẻ nhất mà khách chưa đủ điểm** và còn hàng (Voucher 500) | P1 |
| C-DASH-07 | Khách có 5000 điểm (đủ mua mọi quà) | Mở `/dashboard` | Không hiện gợi ý "còn thiếu X điểm" | P2 |

---

## 5. Customer — Đổi quà (C-RWD)

Nguồn: `src/app/(customer)/(account)/rewards/actions.ts` → RPC `redeem_reward` (`0006_redeem_rpc.sql`)

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| C-RWD-01 | Khách 600 điểm | `/rewards` → đổi Voucher (500 điểm) | Thành công; điểm còn 100; `quantity` giảm 100→99; `/history` có dòng `REDEEM` | P0 |
| C-RWD-02 | Khách 400 điểm | Đổi Voucher (500 điểm) | `"Bạn chưa đủ điểm để đổi phần quà này."` (P0003); điểm không đổi | P0 |
| C-RWD-03 | Admin đặt `quantity = 0` cho 1 quà | Khách đủ điểm bấm đổi | `"Phần quà này đã hết hàng."` (P0002); không trừ điểm | P0 |
| C-RWD-04 | Admin tắt `is_active` của 1 quà | Khách bấm đổi (từ tab đang mở trước đó) | `"Phần quà này không còn khả dụng."` (P0001) | P0 |
| C-RWD-05 | Khách 600 điểm, mở 2 tab cùng trang | Bấm đổi Voucher gần như đồng thời ở cả 2 tab | Chỉ **một** lần thành công; tab kia báo không đủ điểm; điểm cuối = 100, `quantity` giảm đúng 1 | P0 |
| C-RWD-06 | Phiên hết hạn (xoá cookie) | Bấm đổi | `"Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."` | P1 |
| C-RWD-07 | Có quà thuộc nhiều `category` | Mở `/rewards` | Thanh tab dựng từ các category phân biệt; lọc đúng | P1 |
| C-RWD-08 | Có quà `is_featured = true` | Mở `/rewards` | Đúng 1 quà nằm ở hero đầu trang | P1 |
| C-RWD-09 | Có quà `is_exclusive = true` | Mở `/rewards` bằng tài khoản hạng thấp | Quà exclusive hiển thị đúng theo quy tắc hiện hành của UI (đánh dấu / khoá), không crash | P2 |
| C-RWD-10 | Sau C-RWD-01 | Mở `/dashboard` | Số điểm ở dashboard đã cập nhật ngay (revalidate `/dashboard`, `/rewards`, `/history`) | P1 |

---

## 6. Customer — Màn hình hạng (C-TIER)

Nguồn: `(account)/tiers/page.tsx` · `resolveDisplayTier` (`loyalty.ts:546`) · `tier-accent.ts`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| C-TIER-01 | Khách hạng Vàng | Mở `/tiers` | Hiện đủ **5 thẻ hạng**, thẻ Vàng được đánh dấu là hạng đang giữ | P1 |
| C-TIER-02 | — | Xem màu nhấn từng thẻ | Màu chọn theo **thứ hạng (rank)**, không theo tên hạng — đổi tên hạng ở admin không được đổi màu | P1 |
| C-TIER-03 | Khách giữ Vàng (`tier_id` = Vàng), chi tiêu 3.500.000đ. Admin nâng mốc Vàng lên 5.000.000đ và áp dụng | Mở `/tiers` và `/dashboard` | Khách **vẫn là Vàng** — không bị tụt về Bạc. `customers.tier_id` không đổi (đây chính là cơ chế grandfathering) | P0 |
| C-TIER-04 | Như C-TIER-03 | Xem thanh tiến trình | Đáy thanh = mốc hạng **đang giữ** (Vàng), đích = hạng kế trên (Bạch kim) — không bảo khách "phấn đấu lên Vàng" khi họ đã là Vàng | P0 |
| C-TIER-05 | Khách vừa có đơn đủ lên Bạch kim | Mở `/tiers` | Hiện Bạch kim (hạng cao hơn giữa hạng lưu và hạng chi tiêu kiếm được) | P1 |
| C-TIER-06 | Admin sửa perks của 1 hạng | Mở `/tiers` | Perks mới hiển thị; perk có `detail` rỗng chỉ hiện dòng tiêu đề | P2 |
| C-TIER-07 | Khách giữ hạng nhờ grandfathering | Mở `/tiers` | Có ghi chú kiểu "giữ theo mốc cũ" (dữ liệu từ `customer_tier_history` / `getLatestTierAward`) | P2 |
| C-TIER-08 | Khách mới, chi tiêu 0đ | Mở `/tiers` | Hạng Bạc, tiến trình về Vàng = 0%, còn thiếu 3.000.000đ | P1 |

---

## 7. Customer — Lịch sử (C-HIS)

Nguồn: `(account)/history/page.tsx` · `getTransactions` (`loyalty.ts:342`)

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| C-HIS-01 | Khách có cả `EARN` và `REDEEM` | Mở `/history` | Cả hai loại hiện đúng dấu (+/−) và đúng ngày | P1 |
| C-HIS-02 | Khách có > 1 trang giao dịch | Bấm phân trang | Trang 2 hiện đúng, không lặp dòng | P1 |
| C-HIS-03 | Khách 0 giao dịch | Mở `/history` | Empty state | P2 |
| C-HIS-04 | Admin vừa điều chỉnh điểm cho khách | Khách mở `/history` | Có dòng điều chỉnh kèm lý do admin nhập | P1 |
| C-HIS-05 | Có 2 khách khác nhau | Đăng nhập khách A, mở `/history` | **Chỉ** thấy giao dịch của A — không có dòng nào của B | P0 |

---

## 8. Customer — Hồ sơ (C-PRO)

Nguồn: `(account)/profile/actions.ts` → RPC `update_customer_profile` (`0007`) · `makeProfileSchema`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| C-PRO-01 | Đã đăng nhập | Sửa họ tên → Lưu | Lưu thành công; `/dashboard` hiện tên mới | P1 |
| C-PRO-02 | — | Điền đủ thông tin thú cưng (tên, loại, ngày sinh) → Lưu | Lưu thành công, hiển thị lại đúng sau khi tải lại trang | P1 |
| C-PRO-03 | Đã có tên thú cưng | Xoá trắng ô tên thú cưng → Lưu | Lưu thành `null`, không phải chuỗi rỗng; không lỗi Postgres | P1 |
| C-PRO-04 | — | Xoá trắng họ tên → Lưu | `"Vui lòng nhập tên"` | P1 |
| C-PRO-05 | — | Nhập ngày sinh sai định dạng | `"Ngày không hợp lệ"` | P2 |
| C-PRO-06 | — | Kiểm tra ô số điểm / hạng trên trang hồ sơ | **Không** có ô nào cho khách tự sửa điểm, hạng, chi tiêu | P0 |
| C-PRO-07 | Có 2 khách A, B | Đăng nhập A, dùng devtools sửa payload gửi lên để nhắm vào id của B | Không đổi được gì của B — `customer_id` lấy từ session, không lấy từ payload | P0 |

---

## 9. Customer — Trung tâm hỗ trợ (C-HELP)

Nguồn: `(account)/help/actions.ts` · `makeSupportRequestSchema`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| C-HELP-01 | Đã đăng nhập | Điền tên, email, chủ đề, nội dung → Gửi | Gửi thành công; ticket hiện ở `/admin/support` với trạng thái mở | P1 |
| C-HELP-02 | — | Không chọn chủ đề | `"Vui lòng chọn chủ đề"` | P2 |
| C-HELP-03 | — | Nội dung trống | `"Vui lòng mô tả vấn đề"` | P2 |
| C-HELP-04 | — | Nội dung > 2000 ký tự | `"Vui lòng viết ngắn hơn 2000 ký tự"` | P2 |
| C-HELP-05 | — | Email sai định dạng | `"Email không hợp lệ"` | P2 |
| C-HELP-06 | Đăng nhập bằng A | Sửa payload để gán ticket cho khách B | Ticket vẫn thuộc A — `customer_id` lấy từ session; bảng `support_requests` không có policy INSERT cho khách | P0 |

---

## 10. Admin — Đăng nhập (A-LOG)

Nguồn: `src/app/admin/login/actions.ts`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-LOG-01 | Tài khoản admin | `/admin/login` → email + mật khẩu đúng | Vào `/admin` | P0 |
| A-LOG-02 | — | Mật khẩu sai | `"Thông tin đăng nhập không đúng."` | P0 |
| A-LOG-03 | — | Bỏ trống email hoặc mật khẩu | `"Vui lòng nhập email và mật khẩu."` | P2 |
| A-LOG-04 | Đã đăng nhập admin | Vào lại `/admin/login` | Chuyển về `/admin` | P1 |
| A-LOG-05 | **Dùng tài khoản customer** | Đăng nhập ở `/admin/login` bằng email của customer | Đăng nhập vào được Supabase nhưng bị middleware đẩy về `/dashboard` — **không** vào được `/admin` | P0 |

---

## 11. Admin — Dashboard (A-DASH)

Nguồn: `src/app/admin/page.tsx` · `getSupportCounts` · `LOW_STOCK = 5`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-DASH-01 | DB có khách + giao dịch | Mở `/admin` | Tổng số khách, tổng giao dịch, tổng điểm phát ra / đã đổi khớp DB | P1 |
| A-DASH-02 | Quà "Combo chăm sóc" còn 5 cái | Mở `/admin` | Xuất hiện trong cảnh báo sắp hết hàng (ngưỡng `LOW_STOCK = 5`) | P1 |
| A-DASH-03 | Có ticket hỗ trợ đang mở | Mở `/admin` | Đếm đúng số ticket mở | P1 |
| A-DASH-04 | DB trống hoàn toàn | Mở `/admin` | Empty state, không crash, không NaN | P1 |
| A-DASH-05 | Có > 5 giao dịch | Mở `/admin` | Danh sách gần đây chỉ hiện 5 dòng | P2 |

---

## 12. Admin — Cấu hình loyalty (A-SET)

Nguồn: `src/app/admin/settings/actions.ts` · `makeLoyaltySettingsSchema`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-SET-01 | — | Đổi `rounding` sang `ceil` → Lưu | `"Đã lưu cài đặt."`; đơn mới làm tròn lên | P1 |
| A-SET-02 | — | `unmapped_sku_points = 10` → Lưu | Đơn có SKU chưa map cộng 10 điểm/sp | P1 |
| A-SET-03 | — | `claimable_statuses = "3, 16"` → Lưu | Lưu thành `{3,16}` | P0 |
| A-SET-04 | — | `claimable_statuses = "3, 16,"` (dấu phẩy thừa) | Đoạn rỗng bị **bỏ**, KHÔNG thành `0`. Kết quả `{3,16}` — nếu ra `{0,3,16}` là bug (0 = đơn mới chưa thanh toán sẽ được cộng điểm) | P0 |
| A-SET-05 | — | `claimable_statuses = "999"` | `"Nhập các số, cách nhau bằng dấu phẩy"` — không lưu status không tồn tại | P0 |
| A-SET-06 | — | `claimable_statuses` trống | `"Nhập các số, cách nhau bằng dấu phẩy"` | P1 |
| A-SET-07 | — | `unmapped_sku_points = -5` | `"Phải >= 0"` | P1 |

---

## 13. Admin — Sửa hạng (A-TIER)

Nguồn: `src/app/admin/tiers/actions.ts` → `saveTier` · `MAX_PERKS = 6`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-TIER-01 | — | Mở `/admin/tiers` | Đủ 5 hạng, đúng mốc và hệ số như bảng seed | P1 |
| A-TIER-02 | — | Sửa hệ số Vàng thành 1.3 → Lưu | `"Đã lưu hạng."`; đơn mới của khách Vàng nhân 1.3 | P1 |
| A-TIER-03 | — | Sửa `multiplier = 0` | `"Phải lớn hơn 0"` | P1 |
| A-TIER-04 | — | Xoá trắng tên hạng | `"Vui lòng nhập tên hạng"` | P1 |
| A-TIER-05 | — | Thêm perk thứ 7 | `"Tối đa 6 quyền lợi"` | P1 |
| A-TIER-06 | — | Thêm perk để trống tiêu đề | `"Cần nhập tên quyền lợi"` | P2 |
| A-TIER-07 | — | Tìm nút "Thêm hạng mới" | **Không có** — thang 5 hạng là cố định, chỉ sửa không thêm. Nếu gửi payload không có `id` thì bị từ chối (`"Lưu thất bại."`), không được tạo hạng thứ 6 | P0 |
| A-TIER-08 | Vừa sửa hạng xong | Mở `/tiers` bằng tài khoản khách | Thay đổi hiện ngay (đã revalidate `/tiers`, `/dashboard`) | P1 |

---

## 14. Admin — Lịch nâng mốc (A-SCH)

Nguồn: `saveTierSchedule` / `cancelTierSchedule` / `previewPercentileAmount` (`admin/tiers/actions.ts:82`) · RPC `apply_due_tier_schedules`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-SCH-01 | — | Đặt lịch: hạng Vàng, mode `amount`, 5.000.000đ, hiệu lực ngày mai | `"Đã đặt lịch nâng mốc."`; lịch hiện ở trạng thái chờ | P1 |
| A-SCH-02 | Đã có 1 lịch chờ cho Vàng | Đặt thêm lịch nữa cho Vàng | `"Hạng này đã có một lịch nâng mốc đang chờ. Hãy huỷ lịch cũ trước."` (unique `tier_schedule_one_pending`) | P0 |
| A-SCH-03 | — | Mode `amount` nhưng để trống số tiền | `"Nhập số tiền mới"` | P1 |
| A-SCH-04 | — | Mode `percentile`, để trống % | `"Nhập tỷ lệ phần trăm"` | P1 |
| A-SCH-05 | — | Mode `percentile`, nhập `0` hoặc `100` | `"Phải nằm trong khoảng 0 đến 100"` | P0 |
| A-SCH-06 | — | Mode `amount`, nhập `0` | `"Phải lớn hơn 0"` | P0 |
| A-SCH-07 | Có ≥ 3 khách với chi tiêu khác nhau | Mode `percentile`, nhập `5` | Hiện preview "top 5% ≈ X đ" tính từ `tier_percentile_amount()` trên `lifetime_spend` thật; **không** lưu con số này | P1 |
| A-SCH-08 | Chưa có khách nào có chi tiêu | Preview percentile | `"Chưa có thành viên nào phát sinh chi tiêu."` | P2 |
| A-SCH-09 | Lịch **chưa** áp dụng | Bấm huỷ | `"Đã huỷ lịch nâng mốc."`; dòng biến mất | P1 |
| A-SCH-10 | Lịch **đã** áp dụng (`applied_at` khác null) | Thử huỷ | Không xoá được — bản ghi đã áp dụng là dấu vết kiểm toán, phải giữ | P0 |
| A-SCH-11 | Lịch mode `percentile`, đã tới hạn | Mở `/admin/tiers` (kích hoạt fire-and-forget) | Lịch được áp dụng: `%` đã đổi thành số đồng cụ thể và **đóng băng**; `membership_tiers.spend_threshold` cập nhật; **`customers.tier_id` KHÔNG bị đụng tới** | P0 |

---

## 15. Admin — Sản phẩm / SKU (A-PRD)

Nguồn: `src/app/admin/products/actions.ts` · `sku-picker.tsx`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-PRD-01 | — | Thêm SKU mới + điểm → Lưu | `"Đã lưu sản phẩm."` | P1 |
| A-PRD-02 | SKU `SP000001` đã tồn tại | Thêm lại đúng SKU đó | `"Mã SKU này đã được cấu hình."` (23505) | P1 |
| A-PRD-03 | — | Sửa `points_awarded` của `SP000001` thành 80 | Lưu; đơn **mới** cộng theo 80; đơn cũ đã claim không đổi | P0 |
| A-PRD-04 | — | Nhập điểm âm | `"Phải >= 0"` | P1 |
| A-PRD-05 | — | Bỏ trống mã SKU | `"Vui lòng nhập mã SKU"` | P2 |
| A-PRD-06 | — | Tắt `is_active` của 1 SKU | Đơn mới có SKU đó dùng `unmapped_sku_points` thay vì điểm đã cấu hình | P0 |
| A-PRD-07 | — | Xoá 1 SKU → xác nhận | Xoá thành công; nếu lỗi hiện `"Xoá thất bại."` | P1 |

---

## 16. Admin — Kho quà (A-RWD)

Nguồn: `src/app/admin/rewards/actions.ts`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-RWD-01 | — | Tạo quà mới đủ trường → Lưu | `"Đã lưu quà tặng."`; hiện ngay ở `/rewards` phía khách | P1 |
| A-RWD-02 | "Túi cát" đang `is_featured` | Bật `is_featured` cho quà khác | `"Đã có phần quà khác đang nổi bật. Hãy tắt phần quà đó trước."` (unique riêng phần `rewards_one_featured`) | P0 |
| A-RWD-03 | Như A-RWD-02 | Tắt featured của Túi cát trước, rồi bật cho quà khác | Thành công | P1 |
| A-RWD-04 | — | Nhập `points_cost` âm | `"Phải >= 0"` | P1 |
| A-RWD-05 | — | Nhập `image_url` không phải URL | `"URL không hợp lệ"` | P2 |
| A-RWD-06 | — | Bỏ trống tên quà | `"Vui lòng nhập tên quà"` | P2 |
| A-RWD-07 | — | Nhập `category` mới chưa từng có | Không cần migration; tab mới xuất hiện ở `/rewards` | P1 |
| A-RWD-08 | — | Tắt `is_active` của 1 quà | Quà biến mất khỏi `/rewards` của khách | P1 |
| A-RWD-09 | Quà đã có người đổi | Xoá quà | Xoá được hoặc báo `"Xoá thất bại."` tuỳ ràng buộc khoá ngoại — kiểm tra lịch sử của khách **không** bị mất dòng `REDEEM` | P0 |

---

## 17. Admin — Khách hàng & điều chỉnh điểm (A-CUS)

Nguồn: `src/app/admin/customers/[id]/actions.ts` → RPC `adjust_points` (`0008`, `0012`)

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-CUS-01 | — | Mở `/admin/customers`, tìm theo SĐT | Ra đúng khách | P1 |
| A-CUS-02 | — | Tìm theo tên / email | Ra đúng khách | P2 |
| A-CUS-03 | > 1 trang khách | Bấm phân trang | Đúng dữ liệu, không lặp | P2 |
| A-CUS-04 | Khách 100 điểm | `current_delta = +50`, lý do "bù đơn lỗi" → Lưu | `"Đã áp dụng điều chỉnh."`; điểm 150; **có dòng ledger** kèm lý do và email admin | P0 |
| A-CUS-05 | Khách 100 điểm | `current_delta = -200` | `"Thao tác này sẽ làm số điểm âm."` (P0003); điểm giữ nguyên 100 | P0 |
| A-CUS-06 | — | Để trống cả 3 (điểm hiện tại, điểm tích luỹ, hạng) | `"Nhập số điểm thay đổi hoặc chọn hạng để cấp"` — chặn từ form trước khi gọi RPC | P1 |
| A-CUS-07 | Khách đang hạng Vàng | Cấp thẳng hạng Kim cương, không đổi điểm | Hạng lên Kim cương; **`lifetime_spend` KHÔNG tăng**, `lifetime_points` KHÔNG tăng — cấp hạng không được bịa chi tiêu | P0 |
| A-CUS-08 | Khách đang hạng Kim cương | Cấp hạng Vàng (thấp hơn) | `"Không có gì để áp dụng — khách đã ở hạng này hoặc cao hơn."` (P0005) — hạng chỉ đi lên | P0 |
| A-CUS-09 | — | Bỏ trống lý do | `"Cần nhập lý do"` | P1 |
| A-CUS-10 | — | Lý do > 500 ký tự | `"Vui lòng viết ngắn hơn 500 ký tự"` | P2 |
| A-CUS-11 | — | Nhập delta là số thập phân (`1.5`) | `"Phải là số nguyên"` | P2 |
| A-CUS-12 | Đăng nhập bằng **customer**, lấy id một khách bất kỳ | Gọi thẳng server action `adjustPoints` (fetch từ console) | `"Chỉ tài khoản nhân viên mới được điều chỉnh điểm."` — action tự kiểm claim admin, không tin vào route | P0 |

---

## 18. Admin — Giao dịch (A-TRX)

Nguồn: `src/app/admin/transactions/page.tsx` · `getAdminTransactions` (`loyalty.ts:399`)

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-TRX-01 | Có giao dịch từ nhiều nguồn | Mở `/admin/transactions` | Hiện đủ, phân biệt được `source`: `claim` (đăng ký) / `webhook` / `admin` | P1 |
| A-TRX-02 | — | Tìm theo SĐT | Chỉ ra giao dịch của khách đó | P1 |
| A-TRX-03 | — | Bấm phân trang | Đúng dữ liệu | P2 |
| A-TRX-04 | Có giao dịch điều chỉnh của admin | Xem dòng đó | Hiện lý do + admin nào thao tác | P1 |
| A-TRX-05 | Giao dịch từ đơn Pancake | Xem dòng đó | `order_code` hiển thị là **`id` chuẩn của Pancake**, không phải chuỗi người dùng gõ | P1 |

---

## 19. Admin — Ticket hỗ trợ (A-SUP)

Nguồn: `src/app/admin/support/actions.ts`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| A-SUP-01 | Có ticket mở (từ C-HELP-01) | Mở `/admin/support` | Ticket hiện đủ tên, email, chủ đề, nội dung | P1 |
| A-SUP-02 | — | Bấm đóng ticket | `"Đã đóng yêu cầu."`; số đếm ở `/admin` giảm | P1 |
| A-SUP-03 | Ticket đã đóng | Bấm mở lại | `"Đã mở lại yêu cầu."` | P1 |
| A-SUP-04 | — | Gửi id không tồn tại | `"Không cập nhật được yêu cầu."` (update trúng 0 dòng cũng tính là lỗi) | P1 |
| A-SUP-05 | Đăng nhập bằng customer | Gọi thẳng `setSupportStatus` | `"Không cập nhật được yêu cầu."` — RLS chặn bằng cách không khớp dòng nào | P0 |

---

## 20. Hệ thống — Webhook Pancake (S-WH)

Nguồn: `src/app/api/webhooks/pancake/route.ts`

Mẫu gọi:

```bash
curl -X POST http://localhost:3000/api/webhooks/pancake \
  -H "content-type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"id":"<order_id>"}'
```

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| S-WH-01 | Khách đã đăng ký (đã có `pancake_customer_id`), đơn mới status 3 | Gọi webhook với id đơn | `200 {"claimed":true,"points_awarded":N}`; điểm + `lifetime_spend` của khách tăng; có dòng `EARN` source `webhook` | P0 |
| S-WH-02 | Không gửi / gửi sai `x-webhook-secret` | Gọi webhook | `401 {"error":"unauthorized"}`; không cộng gì | P0 |
| S-WH-03 | — | Gửi body không phải JSON | `422 {"error":"invalid_json"}` | P1 |
| S-WH-04 | — | Gửi `{}` (không có id đơn) | `422 {"error":"missing_order_id"}` | P1 |
| S-WH-05 | Đã chạy S-WH-01 | Gửi **lại đúng** payload đó | `200 {"claimed":false,"skipped":"already_claimed"}`; điểm **không** cộng lần 2 | P0 |
| S-WH-06 | Đơn của người **chưa** đăng ký | Gọi webhook | `200 ... "skipped":"unknown_customer"`; **không tạo khách mới** (SĐT trên Pancake bị mask nên không thể tạo) | P0 |
| S-WH-07 | Đơn status 0 (không nằm trong `claimable_statuses`) | Gọi webhook | `200 ... "skipped":"not_eligible"`; không cộng | P0 |
| S-WH-08 | Id đơn không tồn tại trên Pancake | Gọi webhook | `200 ... "skipped":"order_not_found"` (200 để Pancake không retry vô hạn) | P1 |
| S-WH-09 | Đặt `PANCAKE_API_KEY` sai | Gọi webhook | `200 ... "skipped":"pancake_misconfigured"` **và** log `CONFIG ERROR — points are being dropped` | P0 |
| S-WH-10 | Pancake trả 5xx / timeout | Gọi webhook | `503 {"error":"pancake_unavailable"}` — để Pancake gửi lại | P0 |
| S-WH-11 | Tắt DB (Supabase local) | Gọi webhook | `503 {"error":"db_unavailable"}` — **không** được trả 200 `unknown_customer` (200 = mất điểm vĩnh viễn) | P0 |
| S-WH-12 | Bất kỳ | Xem response body | Không chứa SĐT / tên / email khách (Pancake ghi log body webhook) | P0 |
| S-WH-13 | Đơn có SKU chưa map, `unmapped_sku_points = 0` | Gọi webhook | Claim thành công với `points_awarded = 0`; `lifetime_spend` vẫn tăng theo tiền đơn | P1 |
| S-WH-14 | Khách hạng Vàng (×1.2), đơn 2 × `SP000001` (50đ) | Gọi webhook | `floor(2 × 50 × 1.2) = 120` điểm | P0 |

---

## 21. Hệ thống — Cron nâng mốc hạng (S-CRON)

Nguồn: `src/app/api/cron/tier-schedules/route.ts`

```bash
curl -H "x-webhook-secret: $WEBHOOK_SECRET" http://localhost:3000/api/cron/tier-schedules
```

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| S-CRON-01 | Có lịch đã tới hạn | Gọi GET có secret | `200 {"applied":[…]}`; `spend_threshold` đã đổi; log ghi `từ -> đến` | P0 |
| S-CRON-02 | — | Gọi không có secret | `401 {"error":"unauthorized"}` | P0 |
| S-CRON-03 | Vừa chạy S-CRON-01 | Gọi lại ngay | `{"applied":[]}` — idempotent, mốc không bị nâng 2 lần | P0 |
| S-CRON-04 | Lịch **chưa** tới hạn | Gọi cron | `{"applied":[]}`; mốc không đổi | P1 |
| S-CRON-05 | Sau S-CRON-01, khách đang ở hạng bị nâng mốc | Kiểm `customers.tier_id` | Không đổi — cron chỉ nâng mốc, không đụng hạng của khách | P0 |
| S-CRON-06 | — | Gọi bằng POST có secret | Hành xử giống GET | P2 |

---

## 22. Hệ thống — Phân quyền & chặn route (S-AUTH)

Nguồn: `src/lib/supabase/middleware.ts` · `src/proxy.ts` · `(account)/account.ts`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| S-AUTH-01 | Chưa đăng nhập | Vào `/admin`, `/admin/customers`, `/admin/tiers` | Chuyển về `/admin/login` | P0 |
| S-AUTH-02 | Đăng nhập bằng **customer** | Vào `/admin` | Chuyển về `/dashboard` — không thấy dữ liệu admin | P0 |
| S-AUTH-03 | Đăng nhập admin | Vào `/dashboard` | Được vào (admin cũng là user hợp lệ), nhưng nếu không có dòng `customers` thì hiện thông báo "chưa có tài khoản điểm" chứ không crash | P1 |
| S-AUTH-04 | Chưa đăng nhập | Vào `/dashboard`, `/rewards`, `/history` | Chuyển về `/login` (chặn ở middleware) | P0 |
| S-AUTH-05 | Chưa đăng nhập | Vào `/profile` | Chuyển về `/login`. **Ghi chú**: route này KHÔNG nằm trong `ACCOUNT_PREFIXES` (`src/lib/supabase/middleware.ts:9`) — chặn xảy ra ở tầng RSC do `getAccount()` tự redirect (`(account)/account.ts:28`). Kết quả người dùng thấy vẫn phải là về `/login` | P0 |
| S-AUTH-06 | Chưa đăng nhập | Vào `/tiers` | Như S-AUTH-05 | P0 |
| S-AUTH-07 | Chưa đăng nhập | Vào `/help` | Như S-AUTH-05 | P0 |
| S-AUTH-08 | Đăng nhập customer A | Vào `/admin/customers/<id-của-B>` | Bị đẩy về `/dashboard`, không đọc được dữ liệu của B | P0 |
| S-AUTH-09 | Đăng nhập customer | Thử `UPDATE public.customers` trực tiếp qua Supabase JS client ở console | Bị RLS từ chối — khách không có đường ghi trực tiếp vào `customers` (`0005`) | P0 |
| S-AUTH-10 | Đăng nhập customer | Thử gọi RPC `claim_points` từ client | Bị từ chối — RPC chỉ cấp cho `service_role` (`0011`, `0013`) | P0 |

---

## 23. Hệ thống — Rate limit (S-RATE)

Nguồn: `src/lib/rate-limit.ts` — 5 lần thất bại / IP, 5 lần thất bại / mã đơn, cửa sổ **15 phút**.
Bộ đếm nằm ở bảng `claim_attempts` (Postgres, không phải bộ nhớ).

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| S-RATE-01 | — | Sai mật khẩu ở `/login` 5 lần liên tiếp, lần 6 nhập **đúng** | Lần 6 vẫn báo `"Quá nhiều lần thử. Vui lòng thử lại sau 15 phút."` | P0 |
| S-RATE-02 | — | Nhập sai mã đơn ở `/register` 5 lần, lần 6 nhập đơn đúng | Bị chặn với cùng thông báo | P0 |
| S-RATE-03 | — | Hammer **cùng một mã đơn** từ 6 IP khác nhau | Bị chặn theo mã đơn ở lần thứ 6 dù IP khác | P0 |
| S-RATE-04 | Đã bị chặn | Đợi qua 15 phút (hoặc xoá `claim_attempts` cũ) | Thử lại được | P1 |
| S-RATE-05 | — | Gửi header `x-forwarded-for: 1.2.3.4, <ip-thật>` giả mạo, đổi giá trị bên trái mỗi lần | Vẫn bị tính chung một budget — lấy hop **phải nhất**, không lấy trái nhất | P0 |
| S-RATE-06 | Pancake lỗi (không phải 404) | Thử đăng ký 6 lần | Không bị chặn — lỗi hệ thống không được trừ lượt của khách (đối chiếu với C-REG-10) | P0 |

---

## 24. Hệ thống — Ngôn ngữ & giao diện (S-I18N / S-THEME)

Nguồn: `src/lib/i18n/*` · `src/lib/theme/config.ts`

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|----|---------------|----------|------------------|---------|
| S-I18N-01 | Cookie `NEXT_LOCALE` chưa có | Mở app | Mặc định **tiếng Việt** | P1 |
| S-I18N-02 | — | Đổi sang tiếng Anh | Toàn bộ chữ đổi sang EN, kể cả thông báo lỗi form và toast | P1 |
| S-I18N-03 | Đang ở EN | Tải lại trang / mở tab mới | Vẫn EN (cookie giữ) | P1 |
| S-I18N-04 | Đang ở EN | Đăng ký sai mã đơn | Thông báo lỗi bằng **tiếng Anh** — schema dựng lại theo locale mỗi request | P1 |
| S-I18N-05 | — | Rà mọi màn hình ở cả 2 ngôn ngữ | Không có key thiếu, không hiện chuỗi dạng `t.xxx.yyy` | P2 |
| S-I18N-06 | Locale `vi` vs `en` | Xem ngày giờ ở `/history` | `vi` → định dạng `vi-VN`; `en` → `en-GB` | P2 |
| S-THEME-01 | — | Bấm nút đổi giao diện | Đổi ngay, không nháy trắng khi tải lại (script khởi tạo theme chạy trước paint) | P1 |
| S-THEME-02 | Đã chọn theme thủ công | Đăng xuất → đăng nhập lại | Giữ nguyên lựa chọn thủ công | P1 |
| S-THEME-03 | Khách mới, ngày sinh cho tuổi ≥ 30 | Đăng ký xong | Theme **sáng** | P2 |
| S-THEME-04 | Khách mới, tuổi < 30 | Đăng ký xong | Theme **tối** | P2 |

---

## 25. Phụ lục — Mã lỗi Postgres

| Mã | RPC | Ý nghĩa | Thông báo hiển thị |
|----|-----|---------|-------------------|
| `P0001` | `claim_points` | Thiếu `order_code` / `phone` / `source` sai | (lỗi hệ thống, chỉ có trong log) |
| `P0001` | `redeem_reward` | Quà không tồn tại / đã tắt | "Phần quà này không còn khả dụng." |
| `P0002` | `claim_points` | Đơn đã được claim (unique `order_code`) | webhook: `already_claimed`; đăng ký: bỏ qua, vẫn giữ liên kết |
| `P0002` | `redeem_reward` | Hết hàng | "Phần quà này đã hết hàng." |
| `P0003` | `redeem_reward` | Không đủ điểm | "Bạn chưa đủ điểm để đổi phần quà này." |
| `P0003` | `adjust_points` | Điều chỉnh làm điểm âm | "Thao tác này sẽ làm số điểm âm." |
| `P0004` | `claim_points` | Chưa có `loyalty_settings` đang bật | (lỗi hệ thống) |
| `P0005` | `adjust_points` | Không có gì thay đổi | "Không có gì để áp dụng — khách đã ở hạng này hoặc cao hơn." |
| `23505` | (unique index) | SKU trùng / 2 quà nổi bật / 2 lịch nâng mốc chờ cùng 1 hạng | tuỳ màn hình, xem A-PRD-02 / A-RWD-02 / A-SCH-02 |

## 26. Phụ lục — Quy tắc bất biến cần kiểm sau MỌI thay đổi code

1. **Điểm chỉ được tính trong `claim_points`** — không có bản sao TypeScript nào. Nếu thấy phép tính điểm trong `src/`, đó là bug.
2. **`claim_points`, `redeem_reward`, `adjust_points`, `update_customer_profile` chỉ cấp cho `service_role`** — không client nào gọi trực tiếp được.
3. **Hạng chỉ đi lên.** Không thao tác nào (nâng mốc, cron, sửa hạng) được làm khách tụt hạng.
4. **Mốc hạng chỉ đi lên**, và chỉ qua `tier_threshold_schedules`.
5. **`order_code` là duy nhất** — một đơn không bao giờ cộng điểm 2 lần, dù đến từ đăng ký hay webhook.
6. **Dữ liệu đọc từ Pancake luôn bị mask** — không được coi tên/SĐT đọc về là thật.
7. **Khách không có đường ghi trực tiếp vào `public.customers`.**
