# Review nghiệp vụ — Chicha Pet Members

> Bản kiểm kê để **bạn duyệt**, không phải để đọc hiểu code. Mô tả đầy đủ nằm ở `OVERVIEW.md`.
>
> **Phần 1** — mỗi dòng là một luật code đang thi hành. Tick ☑ nếu đúng ý bạn, ☒ nếu sai.
> **Phần 2** — vấn đề đã kiểm chứng với code, xếp theo thiệt hại thật.
> **Phần 3** — chỗ `OVERVIEW.md` nói sai.

## Trạng thái sửa

**Đã đóng: mục 1–10 (🔴 + 🟠), cùng 19, 20, 21.** Migration sửa tại chỗ (DB chưa deploy),
nên phải `supabase db reset` trước khi chạy lại.

Còn nợ: 🟡 11–18 và ⚪ 22–25 — đã chuyển sang `OVERVIEW.md` §17 làm danh sách nợ chính.
Một mục 🟡 (#11 `linkPancakeCustomer` im lặng) đóng kèm vì cùng file với #1.

Đính chính so với bản review gốc, phát hiện khi đối chiếu lại code:

| Bản gốc nói | Thực tế |
|---|---|
| `order-status.ts` | đường dẫn thật là `src/lib/pancake/order-status.ts` |
| `schemas.ts` ở `src/lib/validation/` | thật ra `src/lib/schemas.ts` |
| #3 cả hai ô đều chết nhánh `z.literal("")` | chỉ `target_amount`; `target_percentile` thoát được vì `0` fail `.gt(0)` |
| #6 admin xoá được hạng | **không có nút xoá hạng trong UI** — rủi ro nằm ở tầng RLS/PostgREST (`for all` bao gồm DELETE) |
| #18 cron thiếu handler | route **đã có** `GET`; chỉ thiếu `Authorization: Bearer` + `vercel.json` |
| #19 "hoặc xoá" `points.ts` | không xoá được cả file — 5 call site type-only (`Rounding`, `LoyaltyRules`, `SkuPointMap`, `ClaimItem`). Đã xoá 4 hàm, giữ type |
| `/admin/tiers` gọi fire-and-forget | thực tế **`await applyDueTierSchedules()`** (`page.tsx:37`) |

### Hai phát hiện mới trong lúc sửa (không có trong bản gốc)

**1. `claim_points` tự ghi `pancake_customer_id`** (`0011:78`), nên `linkPancakeCustomer`
khớp 0 dòng là kết quả **bình thường** của happy path. Nó phải đọc lại giá trị để phân biệt
"đã link đúng rồi" với "đang trỏ vào POS customer khác" — nếu không, mọi lần đăng ký
thành công sẽ bị từ chối.

**2. 🔴 Không migration nào từng cấp quyền bảng.** Phát hiện khi chạy `supabase db reset`
lần đầu trên máy sạch: DB dựng thuần từ `supabase/migrations/` trả `permission denied for
table …` cho **cả ba** role của PostgREST — `anon`, `authenticated` **và `service_role`**.
App không chạy được. Kéo theo: **toàn bộ RLS policy trong repo chưa từng được chạm tới**,
vì Postgres kiểm GRANT trước rồi mới xét policy.

Ẩn được lâu vì default privileges Supabase đặt cho role `postgres` trong `public` chỉ là
`Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) — không có SELECT/INSERT/UPDATE/DELETE. Project
dựng từ thời default còn là `ALL` vẫn chạy bình thường, nên chỉ lộ ra khi reset sạch.

Sửa: thêm `0013_grants.sql`. GRANT là **cộng thêm**, nên áp lên project đang chạy cũng an toàn.

Hệ quả cho mục **#10** của bản gốc: tiền đề "anon đọc được `loyalty_settings`" **sai** —
anon chưa bao giờ đọc được gì cả vì thiếu grant. Việc gỡ policy vẫn đúng (phòng thủ nhiều
tầng), và `0013` giữ nguyên tư thế đó ở tầng quyền: anon chỉ được SELECT trên
`membership_tiers` và `rewards`.

---

## Phần 1 — Luật đang chạy, duyệt đúng/sai

### A. Kiếm điểm

- [ ] Không có màn hình "nhập mã đơn để tích điểm". Khách chỉ nhập mã đơn **một lần duy nhất lúc đăng ký**, làm bằng chứng sở hữu số điện thoại. — `auth/actions.ts:88`
- [ ] Sau đăng ký, **mọi đơn tự động cộng điểm** qua webhook Pancake. Khách không phải làm gì. — `api/webhooks/pancake/route.ts:61`
- [ ] Chỉ đơn ở **trạng thái được cấu hình** mới cộng điểm (mặc định: đã giao). Đơn chưa xong sẽ được cộng sau, khi Pancake bắn lại. — `admin/settings`, `route.ts:103`
- [ ] Một đơn **không bao giờ cộng điểm hai lần**, kể cả khi Pancake gửi trùng hoặc đăng ký và webhook chạy song song. — `0001_schema.sql:85`
- [ ] SKU chưa khai báo hoặc đã tắt → nhận **điểm mặc định** (`unmapped_sku_points`, đang là 0), không phải bị bỏ qua. — `0011_claim_spend.sql:99`
- [ ] Đơn nâng hạng **không** được hưởng multiplier mới ngay trên chính đơn đó — dùng multiplier của hạng cũ. — `0011:85`
- [ ] Đơn hoàn tiền / số liệu âm **không bao giờ kéo chi tiêu tích luỹ xuống**. — `0011:65`

### B. Hạng thành viên

- [ ] Hạng tính theo **chi tiêu tích luỹ (đồng)**, hoàn toàn tách khỏi điểm. Tiêu điểm không làm tụt hạng. — `0010_spend_tiers.sql`
- [ ] Hạng là **cao nhất từng đạt** — không có cơ chế tụt hạng nào. — `0011:129`
- [ ] Ngưỡng hạng **chỉ được nâng**, không hạ. Người đã đạt hạng cũ **giữ nguyên hạng** dù ngưỡng mới cao hơn (grandfathering). — `0010:209`
- [ ] Lịch nâng ngưỡng kiểu "top N% người chi nhiều nhất" được **giải ra số đồng cụ thể tại thời điểm áp và đóng băng** — về sau không đổi nữa. — `0010:186`
- [ ] Người chi tiêu 0đ **không** được tính vào quần thể xếp phân vị. — `0010:190`
- [ ] Thang cố định **5 hạng**, admin chỉ sửa được ngưỡng/multiplier/quyền lợi, không thêm hạng mới. — `admin/tiers`
- [ ] Lịch nâng ngưỡng bị từ chối (vì chồng lấn hạng trên/dưới) vẫn **đánh dấu đã xử lý** và ghi lý do — không bắn lại mãi. — `0010:258`

### C. Điểm & đổi quà

- [ ] Điểm **chỉ dùng để đổi quà**, không quyết định hạng. — `0006_redeem_rpc.sql`
- [ ] Đổi quà trừ **số dư khả dụng**, không trừ điểm tích luỹ trọn đời. — `0006:69`
- [ ] Hai người đổi món cuối cùng cùng lúc → **chỉ một người thành công**. — `0006:32`
- [ ] Quà hết hàng **vẫn hiển thị** (làm mờ), không bị ẩn. — `rewards/reward-card.tsx:50`
- [ ] Đúng **một** món được lên vị trí nổi bật, ép ở tầng database. — `0007:45`

### D. Điều chỉnh thủ công (admin)

- [ ] Mọi lần chỉnh điểm tay **bắt buộc có lý do** và để lại vết trong sổ giao dịch. — `0012_adjust_tier_direct.sql:43`
- [ ] Cấp hạng tay **chỉ cấp lên**, không hạ. — `0012:73`
- [ ] Cấp hạng tay **không bao giờ bịa chi tiêu** — vì chi tiêu là doanh thu thật, dùng để xếp phân vị. — `0012:114`
- [ ] Lý do tồn tại: Pancake che số điện thoại ở mọi endpoint nên **không thể backfill lịch sử mua hàng** của khách quen.

### E. Danh tính & phân quyền

- [ ] Danh tính khách là **số điện thoại**; email thật chỉ là credential Supabase đòi, tra qua `customers.email`, không bao giờ gửi thư tới. — `auth/actions.ts:signIn`, `0014`
- [ ] Đăng nhập sai luôn báo chung chung — **không tiết lộ số nào đã đăng ký**. — `auth/actions.ts:47`
- [ ] Mã đơn sai, số không khớp đơn, Pancake chết → **cùng một thông điệp**, để không lộ shop có biết số này hay không. — `auth/actions.ts:117`
- [ ] Mã đơn thuộc về một khách POS **đã có tài khoản khác** → từ chối thẳng. — `auth/actions.ts:143`
- [ ] Khách **không có đường ghi trực tiếp** vào dữ liệu điểm/hạng của mình. — `0005_roles_and_customer_rls.sql`
- [ ] Staff xem được portal khách; khách **không** vào được `/admin`. — `supabase/middleware.ts:57`
- [ ] **Không có luồng quên mật khẩu** — link đó hiện chỉ là tooltip. — `login-form.tsx:73`

### F. Tự động hoá & dữ liệu

- [ ] **Đơn hàng không bao giờ được lưu vào database** — luôn fetch live từ Pancake. Chỉ lưu mã đơn làm khoá chống trùng.
- [ ] Nội dung webhook Pancake gửi tới **chỉ được coi là con trỏ** — hệ thống luôn hỏi lại Pancake để lấy dữ liệu thật. Payload giả không mua được gì. — `route.ts:83`
- [ ] Webhook **không tạo được khách mới** — chỉ cộng điểm cho khách đã liên kết. — `route.ts:110`
- [ ] Tên và số điện thoại thật được **đẩy ngược lên Pancake** lúc đăng ký, chỉ điền chỗ POS đang thiếu. — `pancake/client.ts:210`
- [ ] Giao diện mặc định **tiếng Việt**, không có nút đổi ngôn ngữ. — `i18n/config.ts:5`
- [ ] Theme được **đoán theo tuổi** lúc đăng ký (từ 30 tuổi → sáng, còn lại → tối); khách tự đổi thì giữ lựa chọn. — `theme/config.ts`

---

## Phần 2 — Điểm chưa tốt, xếp theo thiệt hại

Toàn bộ đã đối chiếu với code. `OVERVIEW.md` §17 **không ghi cái nào trong nhóm 🔴**.

### 🔴 Nghiêm trọng — mất tiền hoặc hỏng dữ liệu  ✅ ĐÃ ĐÓNG

| # | Vấn đề | Vị trí | Hướng sửa |
|---|---|---|---|
| 1 ✅ | **Khách có thể biến mất khỏi webhook vĩnh viễn.** `pancake_customer_id` không có ràng buộc UNIQUE, và giữa lúc kiểm "POS customer này đã có chủ chưa" (`:143`) với lúc ghi liên kết (`:246`) là một khoảng trống. Hai lần đăng ký đồng thời trên cùng khách POS đều lọt qua cổng và đều ghi được. Từ đó `.maybeSingle()` vỡ vì nhiều dòng → mọi đơn về sau của khách đó bị bỏ im lặng. Đây đúng là thứ comment ở `:141-142` tuyên bố đã chặn | `0001_schema.sql:67`<br>`auth/actions.ts:143,246`<br>`loyalty.ts:124` | Thêm partial unique index trên `pancake_customer_id`; để `linkPancakeCustomer` bắt `23505` |
| 2 ✅ | **Cổng chống cướp tài khoản fail-open.** `getCustomerByPancakeId` chỉ lấy `data`, vứt `error`. Lỗi DB tạm thời → trả `null` → đăng ký đi tiếp và liên kết luôn. Cùng hàm đó ở webhook thì trả **200 `unknown_customer`**; Pancake không retry 200 → **điểm mất vĩnh viễn** | `loyalty.ts:124-134`<br>`route.ts:110-113` | Ném lỗi thay vì nuốt; webhook trả 503 khi lỗi DB |
| 3 ✅ | **Để trống ô "số tiền" khi xếp lịch nâng ngưỡng → xếp lịch ngưỡng 0đ.** `z.union([z.coerce.number(), z.literal("")])` chạy coerce trước, mà `Number("")` = 0, nên nhánh `z.literal("")` **không bao giờ với tới được**. Lần `apply_due_tier_schedules` kế tiếp sẽ **nâng hạng toàn bộ thành viên**. Hiện chỉ thuộc tính `required` của HTML đang chặn | `schemas.ts:129-136`<br>test pin: `schemas.test.ts:137` | Đặt `z.literal("")` **trước** trong union, hoặc `z.preprocess` map `""` → `undefined` |
| 4 ✅ | **Gõ dư dấu phẩy vào cấu hình trạng thái → đơn chưa thanh toán được cộng điểm.** `"3,"` parse thành `[3, 0]`; status 0 của Pancake là "mới" | `schemas.ts`<br>test pin: `schemas.test.ts:58` | Lọc chuỗi rỗng trước khi `Number()` |
| 5 ✅ | **Đơn "đã nhận tiền" âm thầm không được điểm.** Default DB và seed đều là `{3}`, trong khi hằng số trong code là `[3,16]`. Form admin chỉ pre-tick `[3,16]` khi **thiếu hẳn** dòng settings — dòng đã seed hiện `{3}` và không cảnh báo gì | `0001_schema.sql:95`<br>`seed.sql:32-33`<br>`order-status.ts:21`<br>`admin/settings/page.tsx:31` | Thống nhất một nguồn: đổi default DB + seed thành `{3,16}` |
| 6 ✅ | **Xoá một hạng là đường tụt hạng không ai gác.** `tier_id ON DELETE SET NULL` cộng với việc admin có quyền `for all` trên bảng hạng → xoá một hạng làm mọi người đang giữ nó **mất hạng**, multiplier rơi về mức suy ra từ chi tiêu, lịch sử hạng thành mồ côi. Phá thẳng nguyên tắc "không bao giờ tụt hạng" | `0001_schema.sql:62`<br>`0005:41-43` | Chặn xoá ở UI + `on delete restrict`, hoặc cấm hẳn thao tác xoá hạng |

### 🟠 Bảo mật & lạm dụng  ✅ ĐÃ ĐÓNG

| # | Vấn đề | Vị trí | Hướng sửa |
|---|---|---|---|
| 7 ✅ | **Throttle duy nhất còn sống có thể đi vòng.** Giới hạn theo mã đơn là code chết (cả hai call site truyền một tham số), nên chỉ còn giới hạn theo IP — mà `getClientIp` tin **phần tử trái nhất** của `x-forwarded-for`. Trên host nào nối thêm thay vì thay thế header, xoay giá trị giả mỗi request là qua sạch | `rate-limit.ts:14,18-19`<br>`auth/actions.ts:65,108` | Bật lại giới hạn theo mã đơn (truyền `typedCode`); lấy IP theo đúng cách của platform |
| 8 ✅ | **API key Pancake hỏng khoá người dùng thật.** Lỗi cấu hình trông y hệt "mã đơn sai", và **mỗi lần như vậy đốt 1 trong 5 lượt của IP**. Cùng lỗi đó ở webhook thành 503 → Pancake **retry vô hạn** | `auth/actions.ts:117-122`<br>`route.ts:90` | Tách `unauthorized` khỏi `not_found`: không tính vào rate limit, webhook trả 200 + cảnh báo |
| 9 ✅ | **Cùng một người có thể tạo nhiều tài khoản.** `normalizePhone` không kiểm định dạng VN, `makePhoneSchema` chỉ đòi ≥ 6 ký tự → `849012345`, `901234567`, `0901234567` ra ba bí danh email khác nhau | `phone.ts:12-19`<br>`schemas.ts:29-32` | Validate định dạng VN (10 số, đầu 0) trước khi ghép email |
| 10 ✅ | **Anon đọc được cấu hình kinh doanh** trong `loyalty_settings` (làm tròn, điểm SKU lạ, trạng thái tính điểm) — trong khi `product_points` bị giấu khỏi anon vì đúng lý do đó | `0005:58-59` | Siết policy, cho server đọc qua service-role |

### 🟡 Độ bền vận hành

| # | Vấn đề | Vị trí | Hướng sửa |
|---|---|---|---|
| 11 | **Đăng ký có thể kết thúc mà không liên kết, im lặng hoàn toàn.** `linkPancakeCustomer` trả `void`, vứt cả `error` lẫn số dòng ghi được; nếu dòng khách đã mang một `pancake_customer_id` khác thì update khớp 0 dòng và **không có một dòng log nào** — mọi bước best-effort khác đều `console.warn` | `loyalty.ts:185-197`<br>`auth/actions.ts:246` | Trả về kết quả + log khi 0 dòng |
| 12 | **Thang hạng có thể mất tính tăng dần.** `apply_due_tier_schedules()` khoá schedule nhưng **không khoá bảng hạng** — hai lần chạy đồng thời (hoặc một `saveTier` chen vào) đều kiểm hàng xóm trên giá trị trước commit rồi cùng ghi | `0010:245-268` | `for update` trên các dòng `membership_tiers` liên quan |
| 13 | **Điểm tràn `integer` → webhook retry vô hạn.** `22003` thô không ai map, thành 500 | `0011:106-110`<br>`route.ts:132-134` | Kẹp trần điểm mỗi đơn, hoặc bắt `22003` → mã lỗi riêng |
| 14 | **5 action admin báo "đã lưu" cả khi không ghi được gì** (RLS chặn, hoặc `rowId` cũ/sai) — Postgres trả 0 dòng chứ không báo lỗi. Chỉ `setSupportStatus` làm đúng | `admin/tiers/actions.ts:57`<br>`admin/rewards/actions.ts:45,70`<br>`admin/products/actions.ts:34,56` | Dùng `{ count: "exact" }` và coi `count === 0` là thất bại, như `support/actions.ts:26-31` |
| 15 | **`extractOrderId` ưu tiên `payload.id` ở tầng ngoài cùng** — nếu envelope Pancake mang event-id ở đó thì fetch nhầm đơn. Chưa từng test với payload thật | `route.ts:52` | Xác nhận với payload thật rồi cố định thứ tự ưu tiên |
| 16 | **`recordAttempt` thiếu ở nhiều nhánh hơn tài liệu ghi** — cả nhánh `phoneTaken` do link hỏng và `signInFailed`. Ba nhánh khác ghi `orderCode = null` dù `typedCode` đang trong tầm với, nên kể cả bật lại giới hạn theo mã đơn (#7) chúng vẫn không đếm | `auth/actions.ts:174,187,201,212-217,284` | Ghi nhận ở mọi nhánh thất bại, luôn kèm `typedCode` |
| 17 | **Sổ giao dịch không có ràng buộc** buộc dòng EARN phải có `order_code`, cũng không ép dấu của `amount`. Chống trùng chỉ là quy ước; mọi truy vấn tổng hợp đều tin dấu | `0001:70-81` | Thêm CHECK theo `type` |
| 18 | **Cron nhiều khả năng chưa từng chạy trên production.** Vercel Cron gửi `Authorization: Bearer`, không set được `x-webhook-secret`; repo cũng không có `vercel.json`. Đường sống duy nhất hiện nay là lời gọi fire-and-forget lúc render `/admin/tiers` | `api/cron/tier-schedules/route.ts:24` | Chấp nhận thêm `Authorization: Bearer` + khai báo cron |

### ⚪ Chất lượng code / test

| # | Vấn đề | Vị trí |
|---|---|---|
| 19 ✅ | **`points.ts` không có call site production nào** — chỉ test dùng. "Nghĩa vụ đồng bộ TS↔SQL" mà `OVERVIEW.md` coi là rủi ro hàng đầu hiện đang canh một thứ **không ai nhìn thấy**. Hoặc nối nó vào UI preview như ý định ban đầu, hoặc xoá | `points.ts` |
| 20 ✅ | Multiplier ≤ 0 được xử lý ở TS nhưng **không** ở SQL (hiện vô hại nhờ CHECK `multiplier > 0`) | `points.ts:61` vs `0011:96` |
| 21 ✅ | **Không xoá trống được ô "giá cũ" của quà** — cùng lỗi chết nhánh `z.literal("")` như #3 | `schemas.ts:189` · `schemas.test.ts:202` |
| 22 | Mọi hàm đọc phía khách đều dùng service-role → các RLS policy đọc-theo-khách **là code chết**; tuyến phòng thủ thứ hai không tồn tại như tài liệu ngụ ý | `loyalty.ts` |
| 23 | Comment lỗi thời: `points.ts:2` (trỏ `0003`) · `0011:115-116` (nói có cột `order_total`) · `ui/sonner.tsx:12` ("light-only") · `i18n/config.ts:3` (trỏ `setLocale` không tồn tại) · `middleware.ts:8` (nói đồng bộ 6 route, thực tế 3) | |
| 24 | **Không có test cho `signUp`, cho handler webhook, và không có test SQL nào** — toàn bộ logic RPC (nơi chứa mọi luật tiền bạc) không được phủ | |
| 25 | `db-types.ts` là bản mirror ghi tay, không generate từ schema | `db-types.ts:3` |

---

## Phần 3 — `OVERVIEW.md` nói sai ba chỗ  ✅ ĐÃ SỬA

1. ✅ **§11.12 "Không bảng nào có INSERT policy" — sai.** Không có policy `for insert` riêng, nhưng
   sáu bảng có policy `for all` cho admin, **bao gồm cả INSERT**. Phát biểu đúng hẹp hơn:
   `customers`, `transactions`, `claim_attempts`, `customer_tier_history` không có đường ghi trực tiếp.
2. ✅ **Nợ #6 — phân tích tác động sai.** Cột `claimable_statuses` là `not null`, nên nhánh `?? [3]`
   ở `loyalty.ts:79` **không bao giờ chạy được**. Vấn đề thật nằm ở default của DB + seed (mục #5 trên).
   *(Nhánh `?? [3]` đã xoá hẳn cùng đợt này.)*
3. ✅ **Nợ #11 — khoảng dòng lệch.** Đổi tên ở `0010:34-43`, đổi kiểu ở `:46-47` — không phải `:34-47`.

Ngoài ba chỗ đó, toàn bộ 17 mục của `OVERVIEW.md` đã được đối chiếu lại với code: **không tìm thấy
phát biểu sai nào khác**, mọi `file:line` được kiểm tra đều trỏ đúng.

`OVERVIEW.md` §17 đã được viết lại theo đợt sửa này: các mục đã đóng gỡ đi, các mục 🟡/⚪ còn nợ
của bản review này chuyển vào đó. Số dòng trong Phần 1 và Phần 2 ở trên là **của bản gốc** —
nhiều file đã dịch dòng sau đợt sửa.
