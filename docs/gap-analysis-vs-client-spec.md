# Đối chiếu Codebase ↔ Yêu cầu khách hàng (`Tich_Diem_ChiCha.md`)

> Rà soát ngày **2026-08-31**. Bản trước (2026-08-20, HEAD `15bb01b`) đã lỗi thời.
> Nguồn yêu cầu: `docs/Tich_Diem_ChiCha.md`.
> Nguồn hiện trạng: `supabase/migrations/0001`–`0024`, DB hosted `eiqhxuvldfzrinziuyop`, `src/`.

> ⚠️ **Số mục spec đã đổi.** File cũ tên `Tich_Diem_ChiCha_Tong_Hop.md` và đánh số khác.
> Ánh xạ: cũ §6 → mới **§3**, cũ §7 → mới **§4**, cũ §8 → mới **§5**, cũ §9 → mới **§6**,
> cũ §10 → mới **§7**, cũ §11 → mới **§8**. Toàn bộ tài liệu này dùng số MỚI.

---

## 0. Tóm tắt điều hành

Web đã dựng đúng bộ khung và **thang hạng, thang mốc quà, cấu trúc trang đều đã khớp spec**.
Phần còn lệch là **lõi tính điểm, thời điểm chốt điểm, cơ chế thu hồi và toàn bộ tầng voucher**.

| Nhóm | Trạng thái |
|---|---|
| Kiến trúc & bảo mật (RLS, RPC, idempotency) | ✅ Vững |
| Cấu trúc 5 trang khách yêu cầu (§1.1) | ✅ Đủ 5 |
| Thang hạng: mốc + hệ số (§5.2) | ✅ **Đã đóng** — `0023` |
| Quà theo mốc chi tiêu (§4.2) | ✅ **Đã đóng** — `0024` |
| Trang FAQ (§6) + Thể lệ (§5) | ✅ **Đã đóng** — `/faq`, `/terms` |
| Công thức tính điểm (§5.1) | ❌ **Sai mô hình** (per-SKU thay vì 1.000đ = 1 điểm) |
| Chờ hết hạn đổi trả trước khi cộng điểm (§3.1) | ❌ Chưa có |
| Tự động thu hồi điểm (§3.1, §4.2) | ❌ Chưa có |
| Voucher engine (§3.2, §5.3.5) | ❌ Chưa có dòng nào |
| Tụt hạng 365 ngày (§5.2) | ❌ Chưa có — **đã chốt sẽ làm** |
| Ưu đãi đơn đầu tiên (§1.2) | ❌ Chưa có |
| Sinh nhật Sen / Boss (§5.2) | ❌ Chưa có |
| Báo cáo & chống gian lận (§3.3) | ❌ Chưa có |
| Zalo OA / ZNS (§8) | ❌ Chưa có (cố ý dùng email thay SMS) |
| Giao nhận quà vật lý (§5.3.4) | ❌ Chưa có |

---

## 1. Đã đóng kể từ bản 2026-08-20

| Gap cũ | Nội dung | Đóng bởi |
|---|---|---|
| **G5** | Mốc hạng & hệ số sai | `0023_tier_ladder_spec.sql` — nay đúng 1M/2M/4M/8M/40M với 1.0/1.1/1.2/1.4/2.0 |
| **G6** | Không có quà theo mốc chi tiêu | `0024_spend_milestones.sql` + `/rewards/roadmap`; 7 rung đúng §4.2 |
| **G8** | Thiếu trang FAQ | `/faq` (commit `8f901dd`) — đủ 7 câu của §6 |
| **G14** (một phần) | Không có trang Thể lệ | `/terms` với 6 mục |
| **G14** (một phần) | Blog chưa có route công khai | `/blog`, `/blog/[slug]` chuyển vào nhóm `(public)` |

**Quyền lợi theo hạng (§5.2)** cũng đã được thay: `perks` giờ phản chiếu đúng ma trận 7 quyền lợi
của spec, thay cho bộ placeholder cũ ("Miễn phí vận chuyển", "Ưu tiên hỗ trợ 24/7") vốn không có
trong spec. ⚠️ Chỉ **3/7** quyền lợi này có tính năng thật (hệ số điểm, vòng quay, quà đặc quyền
theo `min_tier_id`); phần còn lại là **cam kết vận hành thủ công**, đã ghi rõ trong `seed.sql`.

---

## 2. Đã đóng: drift của DB hosted *(phát hiện mới, không có trong bản cũ)*

Bản cũ chỉ ghi "ledger không đáng tin". Rà soát lần này đo được mức độ thật: **12/24 migration
vắng mặt khỏi ledger**, và hai trong số đó đang gây **lỗi chạy thật**:

| Vấn đề | Hệ quả | Trạng thái |
|---|---|---|
| `transactions_source_check` thiếu `'spin'` (0022 áp dụng dở) | `spin_wheel()` ghi `source='spin'` → **khách quay trúng ô điểm là lỗi**, trong khi vòng quay đang BẬT | ✅ Đã sửa |
| `claimable_statuses = {3,16,6,0,1}` | Cộng điểm cho đơn **new / submitted / canceled** — trái §3.1 và là lỗ hổng gian lận | ✅ Đã sửa → `{3,16}` |
| `0016` chưa hề chạy | `pending_order_reconciliations` và `reconcile_order_spend()` không tồn tại ⇒ `enqueueTikTokReconciliation` thất bại âm thầm | ✅ Đã áp dụng |
| `rewards.original_points_cost` — cột mồ côi, không thuộc migration nào | — | ✅ Đã biến mất |
| `customers.tier_id` là `ON DELETE SET NULL` | `0001` khai `RESTRICT`; xoá một hạng sẽ âm thầm hạ hạng mọi người giữ nó | ✅ Nay đúng `RESTRICT` |

**Cách xử lý:** drop schema `public`, chạy lại `0001 → 0024` + seed qua `apply_migration`. Ledger
nay đủ **24 dòng** và DB khớp repo 1:1. Dữ liệu khách (3 khách, 8 giao dịch) được xoá theo quyết
định của chủ dự án; tài khoản `admin@gmail.com` được giữ nguyên.

> **Bài học cần giữ:** không dùng `supabase db push` trên project này khi ledger còn lệch — nó sẽ
> replay lên database đã có sẵn object. Áp dụng qua `apply_migration` để ledger luôn được ghi.

---

## 3. Đã đóng: mâu thuẫn "app tự hứa" *(phát hiện mới)*

App đang phát ngôn những điều nó không thực hiện được — rủi ro CSKH và pháp lý.

| Nơi | Đã nói | Thực tế | Xử lý |
|---|---|---|---|
| `/terms` mục `earning` | "Đơn bị huỷ hoặc trả hàng thì **không được tính**" | Không có cơ chế thu hồi | ✅ Đổi thành "ChiCha sẽ điều chỉnh lại số dư" (đúng: hiện làm tay qua `adjust_points`) |
| `/terms` mục `tiers` | "Hạng có giá trị trong 365 ngày" | `tier_id` sticky, không bao giờ tụt | ✅ Viết lại cho khớp `/tiers` |
| `/tiers` `retentionBody` | "Hệ thống **không** tự động hạ hạng" | Đúng, nhưng **ngược** với `/terms` | ✅ Hai trang nay nói cùng một điều |
| `register` `dobHint`, `profile` `petDobHint` | Hứa **gửi quà sinh nhật** | `date_of_birth` chỉ dùng chọn theme sáng/tối; `pet_dob` không ai đọc | ✅ Gỡ lời hứa quà |

---

## 4. Còn lệch — chi tiết

### 🔴 G1. Công thức tính điểm sai mô hình (§5.1)

- **Spec:** `1.000 VNĐ chi tiêu thực = 1 điểm`.
- **Hiện tại:** điểm tính theo **từng SKU** (`0011_claim_spend.sql:99-112`,
  `sum(qty × product_points.points_awarded)`), SKU chưa map rơi về `unmapped_sku_points` = **0**.
  Seed chỉ có **2 SKU**.
- **Hệ quả:** khách chi 2 triệu sản phẩm chưa map → **0 điểm**. Hai khách chi bằng nhau nhận điểm
  khác nhau. Bảng "Tổng điểm đã nhận 1.280 / chi 2.368.000đ" (§2) không thể tái hiện.
- **Đã chốt:** thay hẳn bằng `floor(tiền thực trả / vnd_per_point) × hệ số hạng`, **gỡ bỏ**
  `product_points` và trang `/admin/products`.
- **Cơ sở tính tiền đã chốt:** `total_price_after_sub_discount` **không** gồm phí ship, nên giữ
  nguyên `orderSpendTotal()` (`src/lib/pancake/client.ts:284`), không parse thêm trường nào.

### 🔴 G2. Không có thời gian chờ đổi trả (§3.1)

- **Spec:** chỉ cộng khi đơn `COMPLETED` **và đã qua hạn đổi trả** (VD 7 ngày). *"Tuyệt đối không
  cộng khi đơn ở trạng thái PAID hay SHIPPED."*
- **Hiện tại:** cổng gác trạng thái **đã có và đã đúng** (`claimable_statuses = {3,16}`), nhưng
  webhook cộng điểm **ngay lập tức**.
- **Việc phải làm:** bảng `pending_point_credits` + `settle_after_days` + cron
  `/api/cron/settle-points` **fetch lại đơn** trước khi gọi `claim_points`.

### 🔴 G3. Không có tự động thu hồi điểm (§3.1, §4.2)

- Trạng thái 4/5/6/7 (`src/lib/pancake/order-status.ts`) chỉ dùng để **hiển thị nhãn**.
- `transactions.type` chỉ có `EARN/REDEEM/ADJUST`; không có nghịch đảo của `claim_points`.
- **Việc phải làm:** RPC `reverse_claim`, type `REVERSE`, tách `transactions_order_code_uniq`
  thành hai partial index theo `type` (nếu không dòng REVERSE đụng chính dòng EARN của nó).
- **Đã chốt:** cho phép `current_points` **âm** (bỏ CHECK `>= 0`).

### 🔴 G4. Voucher engine chưa tồn tại (§3.2, §5.3.5)

| Yêu cầu | Trạng thái |
|---|---|
| Mã độc bản single-use khi đổi quà | ❌ |
| Trạng thái `USED` ngay khi dùng | ❌ |
| Nút "Huỷ hiệu lực mã" cho CSKH | ❌ |
| Hạn dùng 15 ngày (voucher) / 30 ngày (quà vật lý, dịch vụ) | ❌ |
| Ví voucher của khách | ❌ |
| Hết hạn tự vô hiệu, **không hoàn điểm** | ❌ |

`redeem_reward` chỉ ghi một dòng `REDEEM` — khách không cầm được gì, cửa hàng không có gì đối chiếu.

### 🟠 G5. Tụt hạng 365 ngày (§5.2) — **đã chốt sẽ làm**

- `customers.tier_id` đang là "hạng cao nhất từng đạt, chỉ tăng", được `0010`/`0011`/`0012`/`0001`
  và `AGENTS.md` bảo vệ.
- **Hệ quả bắt buộc:** khi có tụt hạng, **thăng hạng phải đo trên chi tiêu trong chu kỳ**
  (`tier_cycle_spend`) chứ không phải `lifetime_spend` — người vừa bị hạ vẫn có `lifetime_spend`
  trên ngưỡng nên sẽ được thăng lại ngay, khiến decay vô nghĩa.
- **Bẫy im lặng:** `resolveDisplayTier` (`src/lib/loyalty.ts:774`) trả `max(hạng lưu, hạng kiếm
  được)` — dưới decay nó **hoàn tác mọi lần hạ hạng trên màn hình**.

### 🟠 G6. Ưu đãi đơn đầu tiên (§1.2)

200K→giảm 20K, 500K→40K, 800K→60K, mua 6 túi→tặng 1 hoặc voucher 50% (tối đa 100K). Chỉ 1 lần/tài
khoản và **đơn đó không tích điểm**. Hiện chưa có gì; ngược lại `signUp` **vẫn** cộng điểm cho đơn
chứng minh — trái spec.

### 🟠 G7. Chống gian lận & báo cáo (§3.3, §5.3)

| Yêu cầu | Trạng thái |
|---|---|
| Giới hạn 1 SĐT đổi quà tối đa X lần/ngày–tuần | ❌ (`rate-limit.ts` chỉ chặn login/đăng ký, theo IP, và **fail open**) |
| Giới hạn lượt đổi mỗi loại quà trên mỗi khách | ❌ |
| Thống kê tiền quà đã chi theo tháng | ❌ (cần cột giá vốn) |
| Top khách đổi quà nhiều nhất | ❌ |
| Đơn bị trả mà khách đã tiêu điểm | ❌ (phụ thuộc G3) |

### 🟠 G8. Sinh nhật Sen & Boss (§5.2)

Sinh nhật Sen: voucher 50K cho mỗi 1 triệu chi tiêu. Sinh nhật Boss (từ Vàng): **x2 điểm** mọi đơn
trong tuần. Dữ liệu đã có (`date_of_birth`, `pet_dob`) nhưng **không automation nào** đọc chúng.
⚠️ Đăng ký hiện thu ngày sinh của **Sen**; §5.1 yêu cầu ngày sinh **Boss** (`pet_dob` nằm ở `/profile`).

### 🟡 G9. Zalo OA / ZNS (§8)

Chưa có, và app **cố ý** đi hướng khác (`auth/actions.ts:35`: *"no SMS provider, no OTP cost"*).
Xác thực bằng mã đơn hàng thực ra chặt hơn OTP và miễn phí. ⚠️ Nếu khách kỳ vọng voucher chạy được
trong checkout Pancake thì đó là dự án tích hợp riêng — `0020` đã ghi Pancake **không có API coupon**.

### 🟡 G10. Giao nhận quà vật lý (§5.3.4)

7 điều khoản (địa chỉ, 3 lần giao, 03–07 ngày, đồng kiểm, hoàn kho, khiếu nại 30 ngày) — chưa có gì.
**Khuyến nghị: không dựng hệ thống** — toàn bộ là quy trình con người và hãng vận chuyển mà app
không quan sát được; Pancake đã giữ địa chỉ. Chỉ nên thu địa chỉ trên voucher.

### 🟡 G11. Các quy định nhỏ chưa có chỗ đặt

| Yêu cầu | Trạng thái |
|---|---|
| Khách **sỉ** không được tích điểm (§5.1) | ❌ không có cờ phân loại |
| Điểm đang tranh chấp bị **tạm khoá** (§5.3.1) | ❌ |
| Chính sách thay thế khi hết quà | ❌ |
| Blog 3 chuyên mục: Chuyện về Boss / Cát / Sản phẩm (§7) | ❌ `post_type` chỉ có `article`/`promotion` |
| Ô tìm kiếm FAQ (§6) | ❌ — và 3/7 câu trả lời còn placeholder, nội dung hardcode trong i18n |
| Copy "Về ChiCha / ChiCha Membership" (§2) | ❌ không trang nào chứa |
| Điểm có hết hạn không? (§6) | ⚠️ spec chưa trả lời → hiện điểm **không** hết hạn (FAQ đã nói vậy) |

---

## 5. App CÓ mà spec KHÔNG nhắc

| Tính năng | Ghi chú |
|---|---|
| Điểm danh hằng ngày (`0019`) | Không có trong spec — giữ hay bỏ? |
| Quà chào mừng khi đăng ký (`0018`) | Không có trong spec |
| Đối soát đơn TikTok sau 6 ngày (`0016`) | Không có trong spec. Cron chốt điểm 7 ngày (G2) sẽ **bao trùm** nó ⇒ nên gỡ |
| Vòng quay may mắn (`0022`) | ✅ Khớp "Quay số theo ngày" §5.2 |

---

## 6. Quyết định đã chốt với chủ dự án

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | Công thức điểm | Thay hẳn bằng `floor(tiền thực trả / 1000) × hệ số hạng`; gỡ mô hình SKU |
| 2 | Số dư điểm cũ | Không còn liên quan — dữ liệu khách đã xoá khi reset |
| 3 | Tụt hạng 365 ngày | **Có** triển khai đúng §5.2 |
| 4 | Thu hồi khi khách đã tiêu hết điểm | **Cho âm điểm**; bỏ CHECK `current_points >= 0` |
| 5 | Phí ship | `total_price_after_sub_discount` **không** gồm ship ⇒ giữ nguyên `orderSpendTotal()` |
| 6 | Dữ liệu khách khi reset | Xoá sạch; chỉ giữ tài khoản admin |
| 7 | API Pancake | **Không** gọi API ghi sang Pancake ở bất kỳ bước nào |

---

## 7. Còn chờ khách

1. Giá vốn từng phần quà — báo cáo ngân sách (§3.3) rỗng cho tới khi có.
2. 3/7 câu trả lời FAQ về sản phẩm (§6).
3. Danh sách quà đặc quyền (§1.4) — bảng trong spec để trống hoàn toàn.
4. §9 "Cách tặng quà cho khách qua sàn" — sheet trống.
5. Xác nhận thang mốc quà §4.2 là số cuối cùng.
6. Voucher tiêu ở quầy bằng cách nào (nhân viên gõ mã vào admin?).

---

## 8. Rủi ro còn lại

1. **Tụt hạng đảo ngược nguyên tắc lõi** đang được 5 migration + `AGENTS.md` bảo vệ, và kéo theo
   việc đổi cơ sở đo thăng hạng. Hạng mục rủi ro cao nhất.
2. **Cho âm điểm** làm vỡ giả định của mọi chỗ hiển thị số dư — rà UI trước khi bỏ CHECK.
3. **Gói Vercel**: sẽ cần 5 cron; gói Hobby giới hạn 2 ⇒ có thể phải gộp thành một route điều phối.
4. `docs/codemap-flows.md:21,107-108` vẫn mô tả công thức SKU — **đang đúng**, phải cập nhật cùng
   lúc với G1 chứ không phải trước.
