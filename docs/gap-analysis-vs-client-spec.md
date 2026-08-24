# Đối chiếu Codebase ↔ Yêu cầu khách hàng (`Tich_Diem_ChiCha_Tong_Hop.md`)

> Rà soát ngày 2026-08-20 trên nhánh `main` (HEAD `15bb01b`).
> Nguồn yêu cầu: `docs/Tich_Diem_ChiCha_Tong_Hop.md`.
> Nguồn hiện trạng: `supabase/migrations/0001`–`0022`, `src/app`, `src/lib`.

---

## 0. Tóm tắt điều hành

Web hiện tại **đã dựng đúng bộ khung** (đăng ký gắn đơn Pancake, ledger điểm bất biến,
hạng theo chi tiêu, kho quà, blog, check-in, vòng quay, admin đầy đủ). Nhưng **mô hình
tính điểm, thời điểm ghi nhận, và toàn bộ tầng voucher/quà** đang lệch so với spec.

| Nhóm | Trạng thái |
|---|---|
| Kiến trúc & bảo mật (RLS, RPC, idempotency) | ✅ Vững, không cần đổi |
| Cấu trúc 5 trang khách yêu cầu | 🟡 4/5 (thiếu FAQ) |
| Công thức tính điểm | ❌ **Sai mô hình** (per-SKU thay vì 1.000đ = 1 điểm) |
| Trigger cộng điểm & thu hồi điểm | ❌ **Thiếu hoàn toàn** phần chờ đổi trả + rollback |
| Voucher engine (mã độc bản, hạn dùng, thu hồi) | ❌ **Chưa có dòng code nào** |
| Hạng: mốc, hệ số, tụt hạng 365 ngày | ❌ Số liệu sai + logic tụt hạng mâu thuẫn thiết kế |
| Quà theo mốc chi tiêu (milestone) | ❌ Chưa có |
| Ưu đãi đơn đầu tiên | ❌ Chưa có |
| Sinh nhật Sen / Boss | ❌ Chưa có (chỉ có sẵn ô ngày sinh) |
| Báo cáo chống gian lận & ngân sách | ❌ Chưa có |
| Zalo OA / ZNS | ❌ Chưa có (đang cố ý dùng email thay SMS) |
| Giao nhận quà vật lý | ❌ Chưa có |

**Ước lượng:** ~15 hạng mục cần làm, trong đó 6 hạng mục là *chặn nghiệm thu*.

---

## 1. Những phần ĐÃ bám sát yêu cầu ✅

| Yêu cầu | Nơi hiện thực |
|---|---|
| Đăng ký: SĐT + Tên + Ngày sinh + Mã đơn gần nhất (§8.1) | `src/app/(customer)/register/`, `auth/actions.ts` |
| 1 SĐT = 1 tài khoản, không gộp/tách bill (§7.1) | `customers.phone` unique + `customers_pancake_idx` unique |
| Ghi nhận trên số tiền sau chiết khấu (§7.1) | `orderSpendTotal()` dùng `total_price_after_sub_discount` |
| Hạng theo **mức chi tiêu**, không theo điểm (§8.2) | `0010_spend_tiers.sql`, `customers.lifetime_spend` |
| Hệ số nhân điểm theo hạng (§4, §8.2) | `membership_tiers.multiplier` trong `claim_points` |
| Điểm dùng để đổi quà, không quyết định hạng (§1) | `current_points` vs `lifetime_spend` tách bạch |
| Đổi quà tự thao tác, xác nhận là không hoàn (§8.3.2/3.3) | `redeem_reward` RPC (0006/0017) — atomic, không có đường undo |
| Giới hạn tổng số lượt đổi mỗi loại quà (§8.3) | `rewards.quantity` giảm nguyên tử |
| Quà đặc quyền theo hạng (§8.2) | `rewards.min_tier_id` (0017) |
| Quay số theo ngày, mọi hạng (§8.2) | `0022_spin_wheel.sql`, `/spin` |
| Cộng đồng / Blog (§2, §10) | `0020_blog.sql`, `/blog`, `/admin/blog` |
| Trang tổng quan: điểm, rank, thanh tiến độ % (§1, §2) | `/dashboard` |
| Trang Đổi thưởng & Thăng hạng (§2) | `/rewards`, `/tiers` |
| Chống bot khi đăng nhập/đăng ký | `src/lib/rate-limit.ts` |

---

## 2. Những phần LỆCH — chi tiết

### 🔴 G1. Công thức tính điểm sai mô hình (§8.1)

- **Khách yêu cầu:** `1.000 VNĐ chi tiêu thực = 1 điểm`.
- **Hiện tại:** điểm tính theo **từng SKU** qua bảng `product_points`
  (`0011_claim_spend.sql`: `sum(qty × points_awarded)`), SKU lạ rơi về
  `unmapped_sku_points` (mặc định **0**).
- **Hệ quả:** khách mua 2 triệu nhưng SKU chưa map → **0 điểm**. Hai khách chi bằng
  nhau nhận điểm khác nhau. Bảng "Tổng điểm đã nhận 1.280 điểm / chi 2.368.000đ" của
  khách (§1) không thể tái hiện được.
- **Việc phải làm:** đổi `claim_points` sang `floor(order_total / vnd_per_point) × multiplier`.
  Giữ `product_points` như **điểm thưởng cộng thêm tuỳ chọn** (hoặc gỡ hẳn — cần khách chốt).

### 🔴 G2. Không có thời gian chờ đổi trả trước khi cộng điểm (§6.1)

- **Khách yêu cầu:** chỉ cộng khi đơn `COMPLETED` **và đã qua hạn đổi trả (VD 7 ngày)**.
  "Tuyệt đối không cộng khi đơn ở trạng thái PAID hay SHIPPED."
- **Hiện tại:** `src/app/api/webhooks/pancake/route.ts` cộng **ngay lập tức** khi
  `order.status ∈ settings.claimable_statuses` (mặc định `{3, 16}` = đã giao / đã nhận tiền).
- **Việc phải làm:** thêm hàng đợi `pending_point_credits` + cron duyệt sau N ngày
  (N cấu hình trong `loyalty_settings`). Hạ tầng tương tự **đã có sẵn** ở
  `0016_tiktok_reconciliation.sql` + `/api/cron/reconcile-tiktok-orders` — tái dùng khuôn đó.

### 🔴 G3. Không có tự động thu hồi điểm (§6.1, §7.2)

- **Khách yêu cầu:** đơn chuyển `CANCELLED` / `RETURNED` / `REFUNDED` → **tự động trừ lại**
  điểm tương ứng. Nếu đơn giúp đạt mốc bị huỷ thì phải trừ lại mốc.
- **Hiện tại:** **không tồn tại** đường thu hồi nào. Webhook chỉ biết cộng.
  `claim_points` không có nghịch đảo. `adjust_points` (0008) là thao tác tay của admin.
- **Việc phải làm:** RPC `reverse_claim(order_code, reason)` — ghi bút toán âm, trừ
  `current_points` / `lifetime_points` / `lifetime_spend`, và webhook bắt các status huỷ.
  ⚠️ Phải xử lý ca khách **đã tiêu hết điểm** rồi mới huỷ đơn → cho phép `current_points`
  âm hay khoá tài khoản? (hiện `current_points >= 0` là CHECK constraint — sẽ nổ).

### 🔴 G4. Voucher engine chưa tồn tại (§6.2, §8.3.5)

Grep toàn repo: **0 kết quả** cho voucher code / expiry / revoke. Cụ thể thiếu:

| Yêu cầu | Trạng thái |
|---|---|
| Mã độc bản single-use sinh khi đổi quà | ❌ |
| Trạng thái `USED` ngay khi dùng | ❌ |
| Nút "Huỷ hiệu lực mã" cho CSKH | ❌ |
| Hạn dùng cấu hình được (15 ngày voucher / 30 ngày quà vật lý) | ❌ |
| Ví voucher của khách (xem mã, hạn, trạng thái) | ❌ |
| Hết hạn tự vô hiệu, **không hoàn điểm** | ❌ |

Hiện `redeem_reward` chỉ ghi 1 dòng `REDEEM` vào `transactions` rồi thôi — khách không
nhận được gì cầm nắm được, cửa hàng không có gì để quét/đối chiếu.

### 🔴 G5. Số liệu hạng sai + logic tụt hạng mâu thuẫn (§8.2)

**Mốc & hệ số:**

| Hạng | Mốc khách yêu cầu | Mốc trong `seed.sql` | Hệ số yêu cầu | Hệ số hiện tại |
|---|---|---|---|---|
| Bạc | 1.000.000 | **0** | 1.0 | 1.0 |
| Vàng | 2.000.000 | **3.000.000** | 1.1 | **1.2** |
| Bạch Kim | 4.000.000 | **8.000.000** | 1.2 | **1.5** |
| Kim Cương | 8.000.000 | **20.000.000** | 1.4 | **1.8** |
| Ruby | 40.000.000 | **50.000.000** | 2.0 | 2.0 |

> Lưu ý: mốc Bạc = 1.000.000 nghĩa là khách chi dưới 1 triệu **không có hạng**. Thiết kế
> hiện tại giả định luôn có hạng sàn 0đ. Cần chốt: giữ hạng sàn 0đ hay để "chưa có hạng"?

**Tụt hạng — mâu thuẫn kiến trúc:**
- **Khách yêu cầu:** mỗi lần lên hạng reset đồng hồ 365 ngày; nếu trong 365 ngày không chi
  đủ mức của hạng hiện tại → **tụt 1 bậc**.
- **Hiện tại:** `customers.tier_id` được thiết kế là **"hạng cao nhất từng đạt, chỉ tăng
  không giảm"** — điều này được ghi rõ trong `0010`, `0011`, `0012`, `AGENTS.md` và được
  bảo vệ bằng `on delete restrict`. Không có cột `tier_evaluated_at`, không có cron đánh giá.
- **Việc phải làm:** đây là **đảo ngược một nguyên tắc lõi**, không phải thêm tính năng.
  Cần: cột `tier_evaluated_at` + `spend_since_evaluation`, RPC `evaluate_tier_decay()`,
  cron hằng ngày, và viết lại phần "sticky tier" trong `AGENTS.md`.

### 🟠 G6. Không có quà theo mốc chi tiêu (Milestone Reward) (§7.2)

Khách có bảng mốc riêng, **độc lập với thang hạng**:

| Mốc chi | Quà |
|---|---|
| 400.000đ | Súp/Pate (10.000đ) + Voucher 20K |
| 1.200.000đ | Voucher 30K |
| 2.000.000đ | Voucher 50K + 1 túi cát |
| 5.100.000đ | Set Quà Lvl 1 (150.000đ) |
| 8.350.000đ | Set Quà Lvl 2 (250.000đ) |

Hiện tại chỉ có kho quà đổi bằng **điểm**; không có cơ chế **tự trao quà khi chạm mốc chi tiêu**.

### 🟠 G7. Ưu đãi đơn đầu tiên (§3)

- 200K→giảm 20K, 500K→giảm 40K, 800K→giảm 60K, mua 6 túi→tặng 1 túi hoặc voucher 50% (max 100K).
- Chỉ 1 lần / tài khoản, **và đơn đó KHÔNG tích điểm**.
- Khách cũ: cho lên rank theo đơn gần nhất nhưng **không cộng điểm**.
- **Hiện tại:** không có gì. Ngược lại, `signUp` đang **có** claim đơn chứng minh và cộng
  điểm cho nó → trực tiếp vi phạm quy tắc "đơn đầu tiên không tích điểm".

### 🟠 G8. Thiếu trang FAQ / Vấn đề thường gặp (§2 dòng 4, §9)

- Spec liệt kê 5 trang; app có 4. `/help` hiện là **form gửi yêu cầu hỗ trợ**, không phải FAQ.
- Grep `faq` toàn repo: **0 kết quả**.
- Cần: khối FAQ (nhóm Tích điểm / Sản phẩm) + "quy định xử lý", quản trị nội dung được.
- ⚠️ Bản thân spec còn để trống 6/7 câu trả lời — **cần khách cung cấp nội dung**.

### 🟠 G9. Chống gian lận & báo cáo (§6.2, §6.3)

| Yêu cầu | Trạng thái |
|---|---|
| Giới hạn 1 SĐT đổi quà tối đa X lần/ngày hoặc /tuần | ❌ (`rate-limit.ts` chỉ chặn login/đăng ký) |
| Giới hạn lượt đổi **mỗi loại quà** trên mỗi khách (§8.3) | ❌ |
| Thống kê theo tháng: khách đã đổi bao nhiêu tiền (ngân sách) | ❌ |
| Top khách đổi quà nhiều nhất | ❌ |
| Danh sách đơn vừa bị trả mà khách đã lỡ dùng điểm/voucher | ❌ (phụ thuộc G3) |

`/admin` hiện chỉ có tổng phát hành / tổng đã đổi, không có chiều thời gian, không quy ra tiền.

### 🟠 G10. Sinh nhật Sen & Boss (§8.2)

- **Sinh nhật Sen** (mọi hạng): lời chúc + voucher 50K cho mỗi 1 triệu chi tiêu.
- **Sinh nhật Boss** (từ Vàng trở lên): **x2 điểm toàn bộ đơn trong tuần sinh nhật**.
- **Hiện tại:** đã có `customers.date_of_birth` và `customers.pet_dob` (thu ở đăng ký /
  hồ sơ), nhưng **không có automation nào** đọc chúng. `claim_points` không biết đến tuần
  sinh nhật.

### 🟡 G11. Đặc quyền hạng cao chưa có phần thực thi (§8.2)

`membership_tiers.perks` là JSON tự do → hiển thị được, nhưng **không có logic**:
- Bộ sưu tập (Ruby)
- Combo chăm sóc 1 triệu (Ruby)
- Trải nghiệm sản phẩm mới (Kim Cương + Ruby)

Cần chốt với khách: đây là quyền lợi **vận hành thủ công** (chỉ cần hiển thị) hay cần hệ thống?

### 🟡 G12. Zalo OA / ZNS (§11)

Toàn bộ chưa có; và app đang **cố ý đi hướng khác** (`auth/actions.ts:35`:
*"Customer accounts are phone + password — no SMS provider, no OTP cost"*).

| ZNS | Trạng thái |
|---|---|
| OTP xác thực SĐT khi tạo tài khoản | ❌ (đang xác thực bằng mã đơn hàng — cách này thực ra chặt hơn) |
| Cấp mã quà tặng/voucher | ❌ (phụ thuộc G4) |
| Thông báo trạng thái đơn | ❌ |
| Ưu đãi sinh nhật | ❌ (phụ thuộc G10) |

### 🟡 G13. Giao nhận quà vật lý (§8.3.4)

Quy định 7 điều (địa chỉ, 3 lần liên hệ, 03–07 ngày, đồng kiểm, hoàn kho, khiếu nại 30 ngày)
— **không có** bảng địa chỉ giao quà, không có trạng thái fulfillment, không có màn hình
theo dõi cho CSKH. Hiện đổi quà xong là hết, không ai biết phải giao gì cho ai.

### 🟡 G14. Các quy định nhỏ chưa có chỗ đặt

| Yêu cầu | Trạng thái |
|---|---|
| Khách **sỉ** không được tích điểm (§8.1) | ❌ không có cờ phân loại khách |
| Điểm đang tranh chấp bị **tạm khoá** (§8.3.1) | ❌ không có trạng thái freeze |
| Chính sách thay thế khi hết quà (§7 ghi chú) | ❌ chưa có text |
| Trang Thể lệ chương trình (§8) | ❌ form đăng ký có checkbox "đồng ý điều khoản" nhưng **không có trang điều khoản** |
| Blog 3 chuyên mục: Chuyện về Boss / Cát / Sản phẩm (§10) | ❌ `blog_posts.post_type` chỉ có `article`/`promotion`, chưa có taxonomy chuyên mục |
| Điểm có hết hạn không? (§9) | ⚠️ spec chưa trả lời → hiện tại điểm **không hết hạn** |

---

## 3. Những phần app CÓ mà spec KHÔNG nhắc

Không phải lỗi, nhưng nên xác nhận với khách để tránh nghiệm thu hụt:

| Tính năng | Ghi chú |
|---|---|
| Điểm danh hằng ngày (`0019_checkin`) | Không có trong spec — giữ hay bỏ? |
| Quà chào mừng khi đăng ký (`0018_welcome_gift`) | Không có trong spec |
| Đối soát đơn TikTok sau 6 ngày (`0016`) | Không có trong spec — nhưng là hạ tầng tốt, tái dùng cho G2 |
| Vòng quay may mắn (`0022`) | ✅ Khớp "Quay số theo ngày" §8.2 |

---

## 4. KẾ HOẠCH TRIỂN KHAI

Xếp theo thứ tự phụ thuộc kỹ thuật, không phải theo mức độ dễ.

### Giai đoạn 0 — Chốt yêu cầu với khách (trước khi code)

Không thể làm G1/G5/G7/G3 nếu chưa có câu trả lời:

1. **Điểm:** chuyển hẳn sang `1.000đ = 1 điểm`, hay giữ song song điểm thưởng theo SKU?
2. **Mốc hạng:** dùng bộ 1M/2M/4M/8M/40M của §8.2 (bỏ hạng sàn 0đ) — xác nhận?
3. **Hệ số:** 1.0 / 1.1 / 1.2 / 1.4 / 2.0 — xác nhận?
4. **Tụt hạng:** có thực sự triển khai quy tắc 365 ngày không? (đây là đảo ngược thiết kế lõi)
5. **Thời gian chờ đổi trả:** bao nhiêu ngày sau COMPLETED thì chốt điểm? (spec ghi "VD 7 ngày")
6. **Đơn bị huỷ mà khách đã tiêu hết điểm:** cho âm điểm, hay ghi nợ, hay khoá đổi quà?
7. **Đơn đầu tiên không tích điểm:** vậy đơn khách nhập lúc đăng ký có cộng điểm không?
8. **Zalo ZNS:** có mua gói không (300đ/tin)? Nếu không, gửi mã voucher qua đâu — chỉ hiện trên web?
9. **Nội dung còn trống:** 6 câu trả lời FAQ, nội dung Thể lệ, danh sách quà đặc quyền gán theo hạng nào.

### Giai đoạn 1 — Sửa lõi tính điểm *(chặn nghiệm thu)*

| # | Việc | File chính |
|---|---|---|
| 1.1 | Thêm `loyalty_settings.vnd_per_point` (mặc định 1000) | migration `0023` |
| 1.2 | Viết lại phần tính điểm trong `claim_points`: `floor(total / vnd_per_point) × multiplier` | `0023_spend_based_points.sql` |
| 1.3 | Cập nhật `/admin/settings` + form + i18n (2 ngôn ngữ) | `settings-form.tsx`, `en.ts`/`vi.ts` |
| 1.4 | Chỉnh `seed.sql` về đúng mốc & hệ số §8.2 + migration cập nhật DB đang chạy | `seed.sql`, `0024` |
| 1.5 | Bảng tóm tắt trên `/dashboard`: Tổng chi / Tổng điểm nhận / Điểm đã dùng / Điểm hiện có / Hạng (§1) | `dashboard/page.tsx` |

> ⚠️ Đọc `docs/` + memory: **DB hosted đã lệch so với ledger migration** — phải kiểm tra
> schema thật trước khi viết `0023`.

### Giai đoạn 2 — Trigger & thu hồi *(chặn nghiệm thu)*

| # | Việc |
|---|---|
| 2.1 | Bảng `pending_point_credits` + `loyalty_settings.settle_after_days` |
| 2.2 | Webhook: đơn đạt trạng thái chốt → **xếp hàng đợi**, không cộng ngay |
| 2.3 | Cron `/api/cron/settle-points` — duyệt hàng đợi, re-fetch đơn từ Pancake, xác nhận vẫn COMPLETED rồi mới gọi `claim_points` |
| 2.4 | RPC `reverse_claim(order_code, reason)` — bút toán âm cho điểm **và** `lifetime_spend` |
| 2.5 | Webhook bắt status CANCELLED/RETURNED/REFUNDED → xoá khỏi hàng đợi hoặc gọi `reverse_claim` |
| 2.6 | Bỏ CHECK `current_points >= 0` (theo quyết định ở Q6) + màn hình admin xem đơn đã thu hồi |

### Giai đoạn 3 — Voucher Engine *(chặn nghiệm thu)*

| # | Việc |
|---|---|
| 3.1 | Bảng `vouchers`: `code` (unique), `customer_id`, `reward_id`, `status` (ACTIVE/USED/EXPIRED/REVOKED), `issued_at`, `expires_at`, `used_at`, `revoked_by`, `revoke_reason` |
| 3.2 | `rewards.voucher_kind` (`discount` = 15 ngày / `physical` = 30 ngày) + `rewards.validity_days` ghi đè |
| 3.3 | `redeem_reward` sinh mã độc bản trong cùng transaction |
| 3.4 | Ví voucher của khách: `/rewards/my-vouchers` — mã, hạn dùng, trạng thái, đếm ngược |
| 3.5 | Admin `/admin/vouchers`: tra cứu, đánh dấu USED, **nút Huỷ hiệu lực** |
| 3.6 | Cron hết hạn: ACTIVE quá `expires_at` → EXPIRED (**không hoàn điểm**) |
| 3.7 | Text quy định §8.3.3 + §8.3.5 hiển thị tại bước xác nhận đổi |

### Giai đoạn 4 — Chống gian lận & Báo cáo

| # | Việc |
|---|---|
| 4.1 | `loyalty_settings.redeem_limit_per_day` / `_per_week` — chặn trong `redeem_reward` |
| 4.2 | `rewards.max_per_customer` — chặn trong `redeem_reward` |
| 4.3 | `/admin/reports`: ngân sách quà đã chi theo tháng (quy ra tiền, không phải điểm) |
| 4.4 | Top khách đổi quà nhiều nhất |
| 4.5 | Cảnh báo: đơn bị trả mà khách đã dùng điểm/voucher (phụ thuộc 2.4) |
| 4.6 | `customers.customer_type` (`retail`/`wholesale`) — khách sỉ không tích điểm (§8.1) |
| 4.7 | `customers.points_frozen` — khoá điểm khi có tranh chấp (§8.3.1) |

### Giai đoạn 5 — Quà theo mốc & Ưu đãi đơn đầu

| # | Việc |
|---|---|
| 5.1 | Bảng `spend_milestones` (mốc chi → quà/voucher) + `customer_milestone_awards` (idempotent) |
| 5.2 | `claim_points` kích hoạt mốc mới vượt qua → phát voucher (dùng lại engine G4) |
| 5.3 | Admin quản lý mốc trên `/admin/tiers` hoặc màn hình riêng |
| 5.4 | Hiển thị lộ trình mốc trên `/dashboard` + `/tiers` |
| 5.5 | Ưu đãi đơn đầu: bảng ngưỡng giảm giá, cờ `customers.first_order_used`, đơn đầu **không tích điểm** |
| 5.6 | Luồng khách cũ: lên rank theo đơn gần nhất, không cộng điểm |

### Giai đoạn 6 — Sinh nhật & Đặc quyền

| # | Việc |
|---|---|
| 6.1 | Cron sinh nhật Sen: voucher 50K / mỗi 1 triệu chi tiêu |
| 6.2 | `claim_points` nhận biết tuần sinh nhật Boss → x2 điểm (từ hạng Vàng) |
| 6.3 | Huy hiệu / nhắc sinh nhật trên `/dashboard` |
| 6.4 | Chốt & hiện thực (hoặc chỉ hiển thị) đặc quyền Ruby / Kim Cương |

### Giai đoạn 7 — Tụt hạng 365 ngày *(cần quyết định G5 trước)*

| # | Việc |
|---|---|
| 7.1 | `customers.tier_evaluated_at` + `spend_in_current_cycle` |
| 7.2 | `claim_points` reset đồng hồ khi lên hạng |
| 7.3 | RPC `evaluate_tier_decay()` + cron `/api/cron/tier-decay` — tụt đúng 1 bậc |
| 7.4 | Viết lại mục "sticky tier" trong `AGENTS.md` + comment trong `0010`/`0011` |
| 7.5 | `/tiers` hiển thị ngày đánh giá kế tiếp + số tiền còn thiếu để giữ hạng |

### Giai đoạn 8 — Nội dung & Giao nhận

| # | Việc |
|---|---|
| 8.1 | Trang FAQ `/faq` (hoặc thêm khối vào `/help`) + quản trị nội dung |
| 8.2 | Trang Thể lệ `/terms` — nối vào checkbox ở form đăng ký |
| 8.3 | Blog: thêm taxonomy 3 chuyên mục (Chuyện về Boss / Cát / Sản phẩm) |
| 8.4 | Địa chỉ giao quà + bảng `gift_shipments` (trạng thái, số lần liên hệ, mốc 3–7 ngày) |
| 8.5 | Màn hình CSKH xử lý giao quà |
| 8.6 | Text chính sách thay thế khi hết quà |

### Giai đoạn 9 — Zalo OA (tuỳ ngân sách)

| # | Việc |
|---|---|
| 9.1 | Tích hợp ZNS: gửi mã voucher khi đổi quà |
| 9.2 | ZNS trạng thái đơn |
| 9.3 | ZNS ưu đãi sinh nhật |
| 9.4 | (Cân nhắc) ZNS OTP — hiện xác thực bằng mã đơn hàng đã chặt hơn và miễn phí |

---

## 5. Đề xuất thứ tự làm

**Đợt 1 (chặn nghiệm thu):** GĐ 0 → 1 → 2 → 3
Sau đợt này, phần "lõi loyalty" mới thực sự đúng như khách mô tả.

**Đợt 2 (vận hành được):** GĐ 4 → 5 → 8
Đủ để CSKH chạy chương trình thật mà không phải làm tay.

**Đợt 3 (nâng cao):** GĐ 6 → 7 → 9

---

## 6. Rủi ro cần lưu ý

1. **DB hosted lệch migration ledger** — mọi migration mới phải kiểm tra schema thật trước.
2. **GĐ 1 thay đổi công thức điểm** → điểm khách đang có sẽ không còn khớp với logic mới.
   Cần quyết: giữ nguyên số dư cũ, hay tính lại toàn bộ từ `transactions`?
3. **GĐ 7 đảo ngược nguyên tắc "hạng chỉ tăng"** — nguyên tắc này đang được 5 migration và
   `AGENTS.md` bảo vệ. Không nên làm nếu khách chưa chắc chắn.
4. **Spec còn nhiều chỗ trống** (§5, §9, §12, "Cách tính điểm", "Cách thức nhận quà") —
   những phần này không thể ước lượng cho tới khi khách bổ sung.
