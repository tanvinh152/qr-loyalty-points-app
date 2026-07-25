# Tổng quan hệ thống — Chicha Pet Members

> **Tài liệu này mô tả hiện trạng code, không phải spec.** Khi tài liệu lệch với code,
> code là đúng. Mọi tham chiếu ghi dạng `đường/dẫn:dòng` để mở thẳng trong editor.
>
> Đối tượng đọc: người review lại toàn bộ nghiệp vụ mà không phải mở từng file.
> Bản đồ ngắn gọn cho AI agent nằm ở `AGENTS.md`; hướng dẫn cài đặt/chạy nằm ở `README.md`.

---

## Mục lục

| # | Mục | Nội dung |
|---|---|---|
| 0 | [Hệ thống này làm gì](#0-hệ-thống-này-làm-gì) | Tóm tắt nghiệp vụ, stack, biến môi trường |
| 1 | [Bản đồ hệ thống](#1-bản-đồ-hệ-thống) | Sơ đồ kiến trúc, 3 Supabase client |
| 2 | [Bốn nguyên tắc bất biến](#2-bốn-nguyên-tắc-bất-biến) | Đọc trước khi sửa bất cứ gì |
| 3 | [Xác thực & phân quyền](#3-xác-thực--phân-quyền) | Synthetic email, JWT claim, 5 luật redirect |
| 4 | [Flow đăng ký](#4-flow-đăng-ký-signup) | Flow phức tạp nhất — 4 phase |
| 5 | [Cổng sở hữu số điện thoại](#5-cổng-sở-hữu-số-điện-thoại) | Chống mạo danh trên dữ liệu masked |
| 6 | [Flow cộng điểm hằng ngày](#6-flow-cộng-điểm-hằng-ngày-webhook) | Webhook Pancake |
| 7 | [Tính điểm](#7-tính-điểm) | Công thức + nghĩa vụ đồng bộ TS↔SQL |
| 8 | [Hệ thống hạng](#8-hệ-thống-hạng) | Spend-based, sticky, grandfathering |
| 9 | [Đổi quà](#9-đổi-quà) | `redeem_reward` |
| 10 | [Điều chỉnh thủ công](#10-điều-chỉnh-thủ-công-admin) | `adjust_points` |
| 11 | [Schema database](#11-schema-database) | 10 bảng, RLS, index, errcode |
| 12 | [Changelog 12 migration](#12-changelog-12-migration) | Mỗi migration thêm gì, vì sao |
| 13 | [Inventory route & Server Action](#13-inventory-route--server-action) | Toàn bộ bề mặt ứng dụng |
| 14 | [i18n & Theme](#14-i18n--theme) | Hai stack cookie song song |
| 15 | [Design system](#15-design-system) | Token, thang chữ, cạm bẫy build |
| 16 | [Test](#16-test) | Phủ cái gì, thiếu cái gì |
| 17 | [Sổ nợ kỹ thuật](#17-sổ-nợ-kỹ-thuật) | **Mục quan trọng nhất khi review** |

---

## 0. Hệ thống này làm gì

Ứng dụng tích điểm khách hàng thân thiết cho một shop thú cưng bán qua **Pancake POS**.

1. Khách mua hàng tại Pancake POS như bình thường — ứng dụng không can thiệp vào việc bán.
2. Khách đăng ký tài khoản một lần tại `/register`, dùng **một mã đơn gần đây làm bằng
   chứng sở hữu số điện thoại**. Không có màn hình "nhập mã đơn để tích điểm" thủ công.
3. Từ đó về sau, **mọi đơn được cộng điểm tự động** qua webhook Pancake bắn về
   `/api/webhooks/pancake`.
4. Điểm là **tiền tệ** — chỉ dùng để đổi quà tại `/rewards`.
5. Hạng thành viên tính theo **chi tiêu tích luỹ (đồng)**, hoàn toàn tách khỏi điểm.

### Stack

| Thành phần | Version | Ghi chú |
|---|---|---|
| Next.js | 16.2.10 | App Router. **`middleware` đã đổi tên thành `proxy`** → `src/proxy.ts` |
| React | 19.2.4 | React Compiler bật — dùng `useWatch`, không dùng `form.watch()` |
| Supabase | `@supabase/ssr` 0.12.3, `supabase-js` 2.110.7 | Postgres + Auth + RLS |
| shadcn/ui | trên **Base UI** 1.6 | **KHÔNG phải Radix** → Button không có `asChild` |
| Tailwind CSS | v4 | Cấu hình bằng CSS (`@theme inline`), không có `tailwind.config` |
| Zod | v4 | Schema build theo request để lấy thông điệp lỗi đúng ngôn ngữ |
| react-hook-form | 7.82 | + `@hookform/resolvers` |
| Vitest | 4.1 | Hai project: node (unit) + jsdom (component) |

Script: `npm run dev | build | lint | typecheck | test | test:watch | test:coverage`.

### Biến môi trường (`.env.example`)

| Biến | Client thấy được? | Dùng ở đâu |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Cả 3 Supabase client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | `client.ts`, `server.ts`, `middleware.ts` — chịu RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **server-only** | `admin.ts` — bypass RLS, gọi mọi RPC |
| `PANCAKE_API_KEY` | ❌ **server-only** | `src/lib/pancake/client.ts` |
| `PANCAKE_SHOP_ID` | ❌ | như trên |
| `PANCAKE_API_URL` | ❌ | tuỳ chọn, mặc định `https://pos.pages.fm/api/v1` |
| `WEBHOOK_SECRET` | ❌ | **dùng chung** cho cả webhook Pancake lẫn cron tier |

---

## 1. Bản đồ hệ thống

```mermaid
graph LR
    B[Trình duyệt] -->|cookie session| P[proxy.ts<br/>updateSession]
    P --> N[Next.js 16<br/>RSC + Server Actions]

    N -->|anon key, chịu RLS| SA[(Supabase<br/>anon/authenticated)]
    N -->|service_role key<br/>bypass RLS| SS[(Supabase<br/>service_role)]
    N -->|REST, server-only| PC[Pancake POS API]

    PCW[Pancake POS<br/>webhook] -->|x-webhook-secret| WH["/api/webhooks/pancake"]
    CRON[Cron ngoài] -->|x-webhook-secret| CR["/api/cron/tier-schedules"]

    WH -->|claim_points| SS
    WH -->|getOrder xác thực lại| PC
    CR -->|apply_due_tier_schedules| SS

    SS -.->|RPC SECURITY DEFINER| DB[(public.*)]
    SA -.->|RLS policy| DB
```

### Ba Supabase client — chọn sai là lỗ hổng

| File | Key | RLS | Dùng ở đâu |
|---|---|---|---|
| `src/lib/supabase/client.ts` | publishable (anon) | ✅ chịu | Client Component trong trình duyệt |
| `src/lib/supabase/server.ts` | publishable (anon) | ✅ chịu | RSC, Server Action, Route Handler. Cookie qua `next/headers`. `setAll` bọc try/catch vì gọi từ Server Component sẽ throw — middleware lo việc refresh cookie |
| `src/lib/supabase/admin.ts` | **service_role** | ❌ **bypass** | `import "server-only"` chặn lọt vào bundle client. **Đây là client duy nhất gọi được mọi RPC** (trừ `is_admin()`) |

### Nguyên tắc xuyên suốt

**Đơn hàng không bao giờ được lưu vào database.** Chúng sống trong Pancake POS và được
fetch live mỗi lần cần (`cache: "no-store"`). Migration `0001_schema.sql:10-14` xoá hẳn
bảng `orders` của phiên bản trước. Thứ duy nhất được lưu là `transactions.order_code` —
một chuỗi định danh, dùng làm khoá chống trùng.

---

## 2. Bốn nguyên tắc bất biến

Đọc kỹ bốn điều này trước khi sửa bất cứ gì liên quan tới điểm hoặc hạng.

### ① `claim_points` là đường ghi duy nhất cho một lần cộng điểm

Không có đường nào khác. Không được `update customers set current_points = ...` từ code
ứng dụng. RPC nằm ở `supabase/migrations/0011_claim_spend.sql`, chỉ cấp cho `service_role`
(vì nó **tin tưởng danh sách item được đưa vào** — không tự xác thực đơn hàng).

Chống cộng trùng dựa **hoàn toàn** vào partial unique index:

```sql
create unique index transactions_order_code_uniq
  on public.transactions (order_code) where order_code is not null;
```

RPC bắt `unique_violation` và ném lại `P0002 'order already claimed'`. Cả flow đăng ký
lẫn webhook đều đâm vào cùng một cái khoá này — đó là lý do một đơn không bao giờ được
cộng hai lần dù hai đường chạy song song.

### ② Hạng theo CHI TIÊU, điểm là TIỀN TỆ

| Cột | Đơn vị | Quyết định cái gì |
|---|---|---|
| `customers.lifetime_spend` | đồng (`numeric(14,0)`) | **Hạng** — so với `membership_tiers.spend_threshold` |
| `customers.lifetime_points` | điểm | **Không quyết định gì cả** ngoài việc là con số hiển thị |
| `customers.current_points` | điểm | Số dư khả dụng để đổi quà |

Trước migration `0010` thì hạng tính theo `lifetime_points`. Đừng đọc code cũ theo mô hình đó.

### ③ `customers.tier_id` = hạng cao nhất TỪNG đạt — sticky, chỉ tăng

Không có cơ chế tụt hạng nào trong toàn hệ thống.

- Chỉ hai nơi được nâng: `claim_points` (`0011`) và `adjust_points` (`0012`).
- Cả hai đều so bằng **`spend_threshold`**, không phải `sort_order` (vì `sort_order` là số
  nguyên tự do admin gõ được).
- Ngưỡng chỉ được nâng qua `tier_threshold_schedules`, áp bởi `apply_due_tier_schedules()`.
- **`apply_due_tier_schedules()` không hề đụng tới bảng `customers`. Chính sự bỏ sót đó
  LÀ cơ chế grandfathering** — nâng ngưỡng lên không đá ai xuống hạng.

### ④ Khách không có đường ghi trực tiếp vào `public.customers`

Không có RLS policy `INSERT` nào trên bất kỳ bảng nào trong toàn schema. Mọi thay đổi số
dư đều đi qua RPC `SECURITY DEFINER` chỉ cấp cho `service_role`:

| RPC | Được phép chạm | Không được chạm |
|---|---|---|
| `claim_points` | điểm, spend, tier | — |
| `redeem_reward` | `current_points`, tồn kho quà | `lifetime_points`, `lifetime_spend`, `tier_id` |
| `update_customer_profile` | tên, DOB, thông tin thú cưng | **mọi cột điểm/spend/tier** |
| `adjust_points` | điểm, tier | **`lifetime_spend`** |

---

## 3. Xác thực & phân quyền

### Danh tính khách = số điện thoại, credential = email thật

Supabase Auth chỉ hỗ trợ mật khẩu gắn với **email**. Vì vậy `/register` **bắt buộc** nhập
email thật; địa chỉ đó được ghi vào **cả** `auth.users.email` **lẫn** `customers.email`
(một nguồn ghi duy nhất là `signUp`, hai chỗ không được phép lệch nhau).

Form đăng nhập vẫn chỉ có ô số điện thoại: `signIn` tra `customers.email` theo phone rồi mới
gọi `signInWithPassword`. Số điện thoại là **khoá tra cứu**, không phải credential.

```
signIn("0901234567", pw)  →  customers.email  →  signInWithPassword(email, pw)
```

Trước `0014` địa chỉ này là alias tổng hợp `phoneToEmail(phone)` →
`0901234567@customer.chicha-label.app`; hàm đó đã bị xoá.

Không có thư nào được gửi đi — không xác nhận email, không quên mật khẩu. Tài khoản vẫn
được tạo bằng **admin API** `admin.auth.admin.createUser({ email_confirm: true })` để không
có mail xác nhận nào bị xếp hàng, bất kể cấu hình email của project.

### Admin vs khách = một claim JWT duy nhất

```
app_metadata.role === "admin"
```

`app_metadata` **chỉ ghi được bằng service-role key** → khách không thể tự phong mình.
`user_metadata` thì khách sửa được, nên không bao giờ dùng để phân quyền.

Cùng một claim được đọc ở hai tầng:

| Tầng | Nơi đọc |
|---|---|
| Edge (redirect) | `src/lib/supabase/middleware.ts:47` — `user?.app_metadata?.role === "admin"` |
| SQL (RLS policy) | `public.is_admin()` — `supabase/migrations/0005_roles_and_customer_rls.sql:20-34` |

`is_admin()` là **hàm duy nhất trong schema được cấp cho `anon`/`authenticated`**, vì các
RLS policy phải gọi được nó. Nó `SECURITY DEFINER` + `set search_path = public` để khách
không thể tạo hàm cùng tên che nó.

Quá trình đăng ký khách **không hề set `app_metadata`** → khách không bao giờ mang role admin.

### Năm luật redirect — đúng thứ tự

`src/lib/supabase/middleware.ts:56-65`. Session được đọc bằng `supabase.auth.getUser()` —
một lần gọi mạng thật, không phải decode cookie.

| # | Điều kiện | Hành động | Dòng |
|---|---|---|---|
| 1 | ở `/admin` (trừ `/admin/login`) và **chưa** đăng nhập | → `/admin/login` | `:57` |
| 2 | ở `/admin`, **có** session, **không** phải staff | → `/dashboard` | `:59` |
| 3 | ở `/admin/login` và **là** staff | → `/admin` | `:61` |
| 4 | ở route tài khoản và chưa đăng nhập | → `/login` | `:64` |
| 5 | ở `/login`/`/register` mà đã có session | → `/admin` nếu staff, ngược lại `/dashboard` | `:65` |

Hệ quả của thứ tự:

- Luật 2 **không có** điều kiện loại trừ `/admin/login`, và nó chạy trước luật 3 → **một
  khách đang đăng nhập vào `/admin/login` sẽ bị đá về `/dashboard`**, không thấy form
  đăng nhập staff. Muốn dùng form đó phải đăng xuất trước.
- Khách vãng lai vào `/admin/login`: qua luật 1 (bị loại trừ) và luật 3 (`isStaff` false)
  → trang hiển thị bình thường.
- Chỉ `/admin` mới đòi role. `/dashboard`, `/rewards`, `/history` chỉ đòi **có session** —
  staff cũng xem được portal khách.
- Helper redirect xoá sạch query string (`url.search = ""`, `:52`) → **không có cơ chế
  `?next=` quay lại trang cũ**.

`src/proxy.ts` chạy trên **mọi** đường dẫn trừ `_next/static`, `_next/image`, `favicon.ico`
và file ảnh — bao gồm cả `/api/*`.

### ⚠️ Lỗ hổng phòng thủ tầng edge

```ts
// src/lib/supabase/middleware.ts:9
const ACCOUNT_PREFIXES = ["/dashboard", "/rewards", "/history"]
```

Comment ngay trên nói list này "kept in sync with the route group
`src/app/(customer)/(account)/`" — **nhưng route group đó có sáu segment**: `dashboard`,
`help`, `history`, `profile`, `rewards`, `tiers`.

`/tiers`, `/help`, `/profile` **không** được middleware chặn. Chúng vẫn an toàn nhờ tầng
dưới: `(account)/layout.tsx:30` gọi `getAccount()`, và `account.ts:28` tự `redirect("/login")`
khi không có session. Nhưng điểm thực thi khác nhau tuỳ route (edge cho 3 route, RSC cho 3
route còn lại), và comment trong file đang nói sai.

### Server Action tự kiểm tra lại

Middleware không phải cổng duy nhất. **Bất kỳ Server Action nào chạm `createAdminClient()`
đều tự verify lại claim admin**, không tin route:

- `src/app/admin/tiers/actions.ts:74` — `requireAdmin()`
- `src/app/admin/customers/[id]/actions.ts:33`

Các action ở lại trên RLS client (`saveTier`, `saveReward`, `saveProductPoint`,
`saveSettings`, `setSupportStatus`) dựa vào policy. `setSupportStatus` còn coi
`count === 0` là thất bại, vì RLS từ chối bằng cách khớp 0 dòng chứ không báo lỗi
(`admin/support/actions.ts:30-32`).

### Webhook & cron — không dùng session

`src/lib/webhook-auth.ts`:

- Header `x-webhook-secret`, so bằng `timingSafeEqual`.
- **Fail-closed**: `WEBHOOK_SECRET` chưa set → từ chối tất cả.
- Short-circuit khi độ dài lệch (vì `timingSafeEqual` throw nếu hai buffer khác độ dài).
- Pancake **không ký webhook** — chỉ hỗ trợ header tĩnh, nên đây là mức bảo vệ khả dĩ nhất.

**Hai route dùng chung một `WEBHOOK_SECRET`** (webhook Pancake + cron tier). Lý do ghi ở
`api/cron/tier-schedules/route.ts:13-15`: hai secret là thêm một cơ hội xoay nhầm.

---

## 4. Flow đăng ký (`signUp`)

Đây là flow phức tạp nhất trong hệ thống, vì nó vừa là đăng ký, vừa là **bước liên kết**
tài khoản với Pancake POS, vừa là lần tích điểm đầu tiên. Toàn bộ ở
`src/app/(customer)/auth/actions.ts:88-287`.

Form `/register` bắt buộc **toàn bộ** trường: họ tên, email, ngày sinh, số điện thoại, mật
khẩu (≥ 8 ký tự), mã đơn gần đây, checkbox điều khoản (`register-form.tsx`).

```mermaid
flowchart TD
    A[Form /register] --> B{Zod hợp lệ?}
    B -->|không| ERR1[signupFailed]
    B --> C{Rate limit IP?}
    C -->|>=5 lỗi/15p| ERR2[rateLimited]
    C --> D[getOrder từ Pancake]
    D -->|lỗi bất kỳ| ERR3[proofFailed]
    D --> E{matchesOrderPhones?}
    E -->|không| ERR3
    E --> F{order.customer.customer_id có?}
    F -->|không| ERR4[orderNotLinkable]
    F --> G{POS customer đã gắn<br/>tài khoản khác?}
    G -->|rồi| ERR5[orderAlreadyLinked]

    G -->|chưa| H[["PHASE B<br/>find_orphan_auth_user theo phone"]]
    H -->|có orphan| J[updateUserById<br/>đặt lại email + mật khẩu<br/>created = false]
    H -->|không| I[createUser]
    I -->|email đã thuộc tài khoản khác| ERR6[emailTaken]
    I -->|OK| K[created = true]
    J --> L
    K --> L[["PHASE C<br/>linkAuthUserToPhone"]]
    L -->|thất bại| M{created?}
    M -->|có| N[deleteUser rollback] --> ERR7[phoneTaken]
    M -->|không| ERR7

    L -->|OK| O[["PHASE D — best effort<br/>không được biến thành lỗi"]]
    O --> P[claim_points<br/>nếu status claimable]
    P --> Q[linkPancakeCustomer<br/>vô điều kiện]
    Q --> R[update_customer_profile]
    R --> S[updateCustomer<br/>đẩy tên+SĐT thật lên POS]
    S --> T[recordAttempt success<br/>+ seed theme theo DOB]
    T --> U[signInWithPassword]
    U --> V[redirect /dashboard]
```

### Phase A — mọi thứ có thể từ chối, làm TRƯỚC khi tạo auth user

Nguyên tắc ghi ở `:113-114`: nếu có thể từ chối thì phải từ chối **trước** khi có auth
user, để không sinh rác.

| Bước | Dòng | Chi tiết |
|---|---|---|
| 1. Zod | `:95-105` | `makeCustomerSignupSchema`. Checkbox `terms` nhận cả `"on"` (native checkbox post) lẫn `"true"` |
| 2. Rate limit | `:107-108` | `isRateLimited(ip)` — **chỉ theo IP**, không truyền order code (xem [sổ nợ #2](#17-sổ-nợ-kỹ-thuật)) |
| 3. Fetch đơn | `:115-122` | `getOrder(typedCode)`. **Mọi loại lỗi Pancake** (`not_found`/`unauthorized`/`unavailable`/`malformed`) đều gộp thành `proofFailed` |
| 4. Cổng sở hữu | `:127-130` | `matchesOrderPhones(phone, orderPhoneCandidates(order))` → xem [mục 5](#5-cổng-sở-hữu-số-điện-thoại). Thất bại cũng trả `proofFailed` — **cùng thông điệp, để không rò rỉ việc shop có biết số này hay không** |
| 5. Bắt buộc link | `:134-138` | `order.customer?.customer_id` thiếu → `orderNotLinkable`. Không có id này thì webhook về sau không bao giờ quy được đơn cho ai |
| 6. Chống cướp | `:143-146` | `getCustomerByPancakeId()` — nếu POS customer đó đã thuộc một số điện thoại khác → `orderAlreadyLinked`. Từ chối to tiếng còn hơn để `linkPancakeCustomer` (fill-if-NULL) im lặng bỏ qua và để tài khoản không bao giờ liên kết được |
| 7. Chốt mã | `:148-149` | `canonicalOrderCode(order)` — luôn lấy `order.id`, không lấy mã người dùng gõ. Chặn việc một đơn bị claim hai lần qua `id` và `system_id` |

### Phase B — tạo auth user

**Hỏi orphan TRƯỚC khi tạo gì cả**, và tra theo **số điện thoại** chứ không theo email
(`0014`): người đăng ký lại rất có thể đang sửa email gõ sai lần trước, còn số điện thoại
mới là thứ vừa được mã đơn chứng minh.

```sql
-- 0014_real_email_identity.sql (thay bản 0009 tra theo email)
find_orphan_auth_user(p_phone) -- trả về uuid hoặc null
```

Trả về id **chỉ khi** cả ba điều kiện đúng:
1. `raw_user_meta_data->>'phone'` khớp — đúng số này, do `createUser` ghi vào lúc đăng ký.
2. **Không có dòng `customers` nào trỏ tới nó** — một tài khoản thật luôn có, vì
   `linkAuthUserToPhone` chạy ngay sau `createUser` và rollback nếu hỏng. Đây là toàn bộ
   lập luận an toàn: một auth user không có dòng `customers` chỉ có thể là xác của lần
   đăng ký hỏng.
3. `raw_app_meta_data->>'role' <> 'admin'` — để không bao giờ trả về id của staff (staff
   cũng không có dòng `customers`).

- Có orphan → `updateUserById({ email, password, email_confirm: true, user_metadata })`,
  `created = false`, **để rollback không bao giờ xoá tài khoản đã nhận nuôi**.
- Không có → `admin.auth.admin.createUser({ email, password, email_confirm: true,
  user_metadata: { phone } })`. Lỗi `email_exists` / `"already"` ở đây **không còn** nghĩa
  là "số điện thoại đã đăng ký" — nếu số này có auth user thì bước trên đã nhận nuôi rồi —
  mà nghĩa là **email thuộc về người khác** → `emailTaken`. Trùng số điện thoại do
  `linkAuthUserToPhone` bắt ở Phase C, vì `customers.phone` mới là cột unique.

### Phase C — liên kết

`linkAuthUserToPhone(authUserId, phone, email)` — upsert `customers` trên `phone`
(`loyalty.ts:164`). Đây là chỗ điểm mà webhook đã cộng cho số điện thoại này từ trước được
**kế thừa** sang tài khoản mới.

Email được ghi ở đây chứ không giao cho `claim_points`: RPC đó bị bỏ qua hẳn khi đơn chưa
settled, và upsert của nó chỉ điền vào chỗ NULL. Một dòng `customers` có email lệch với
`auth.users.email` thì **không đăng nhập được**, nên bước ghi này phải nằm trên nhánh vô
điều kiện.

Thất bại → rollback `admin.auth.admin.deleteUser()` **chỉ khi `created === true`**.

### Phase D — best-effort, không được biến signup thành lỗi (`:219-286`)

Ghi rõ ở `:219-220`: mọi thứ dưới đây chỉ được `console.warn`, không được trả về lỗi.

| Bước | Dòng | Chi tiết |
|---|---|---|
| Tích điểm đơn bằng chứng | `:225-242` | **Cổng trạng thái nằm ở ĐÂY, không nằm trong RPC**: `settings?.claimable_statuses.includes(order.status)`. Nếu đơn chưa giao xong thì bỏ qua, điểm sẽ về sau qua webhook. Gọi `claim_points` với `p_source: "claim"`, `p_email: null` |
| Liên kết POS | `:246` | `linkPancakeCustomer()` — **vô điều kiện**. Tích điểm có thể bị bỏ qua, nhưng liên kết là thứ webhook về sau dựa vào |
| Ghi hồ sơ | `:250-258` | `update_customer_profile` — họ tên + ngày sinh |
| Đẩy ngược lên POS | `:262-270` | `updateCustomer(pancakeCustomerId, { name, phone })` — ghi tên và số thật lên Pancake, chỉ điền chỗ POS đang thiếu |
| Ghi nhận thành công | `:272` | `recordAttempt(ip, orderCode, true)` |
| Seed theme | `:276` | `themeForDob()` — tài khoản mới, chưa có lựa chọn nào |
| Đăng nhập | `:279-284` | `createUser` không phát session nên phải `signInWithPassword` lần nữa |
| | `:286` | `redirect("/dashboard")` |

### Bảng thông điệp lỗi

| Key | Nguyên nhân thật |
|---|---|
| `signupFailed` | Zod fail, hoặc `createUser` lỗi không phải "đã tồn tại", hoặc nhận nuôi orphan lỗi |
| `rateLimited` | ≥ 5 lần thất bại trong 15 phút từ cùng IP |
| `proofFailed` | Mã đơn sai **hoặc** số điện thoại không khớp đơn **hoặc** Pancake down **hoặc** API key hỏng — gộp có chủ ý |
| `orderNotLinkable` | Đơn không có `customer.customer_id` |
| `orderAlreadyLinked` | POS customer của đơn đã thuộc tài khoản khác |
| `phoneTaken` | `linkAuthUserToPhone` thất bại — dòng `customers` của số này đã thuộc auth user khác |
| `emailTaken` | Email vừa nhập đã thuộc về một tài khoản khác (`email_exists` từ Supabase) |
| `signInFailed` | Tài khoản đã tạo và liên kết xong, nhưng lần đăng nhập cuối hỏng |

### Đăng nhập (`signIn`, `:47-86`)

Zod → rate limit theo IP → `getCustomerByPhone(phone)` lấy `customers.email` →
`signInWithPassword(email, password)`. Số chưa đăng ký (không có dòng, hoặc dòng chưa có
email) đi qua **đúng** rate limiter và trả về **đúng** một thông điệp `invalidCredentials`
như khi sai mật khẩu — **không bao giờ phân biệt số chưa đăng ký với sai mật khẩu**.

Có một bước phụ: nếu đăng nhập thành công **và** cookie theme đang `null` (chưa quyết),
seed theme theo ngày sinh (`:80-83`). Người đã tự bấm đổi theme thì giữ nguyên lựa chọn.

**Không có luồng quên mật khẩu.** Link "Quên mật khẩu" ở `login-form.tsx:73-84` chỉ là một
Tooltip.

---

## 5. Cổng sở hữu số điện thoại

`src/lib/phone.ts`. Đây là thứ ngăn người lạ nhặt được mã đơn của người khác rồi đăng ký
tài khoản trên đơn đó.

### Vấn đề: Pancake che dữ liệu

API Pancake trả về dữ liệu khách hàng **đã bị che** ở mọi endpoint:

```
phone:  "0****70"     ← chỉ thấy chữ số đầu + hai chữ số cuối, độ dài bị giấu
name:   "K******h"
```

Không thứ gì đọc được từ một bản ghi khách hàng Pancake được phép coi là tên thật hay số
thật.

### Cách gom ứng viên

```ts
orderPhoneCandidates(order) // client.ts:296-302
// = [ bill_phone_number,
//     ...customer.phone_numbers,
//     shipping_address.phone_number ]  (lọc bỏ rỗng)
```

Cố tình **không** dừng ở giá trị đầu tiên tìm thấy. Bug cũ chính là chuyện đó: cổng chấp
nhận `bill_phone_number` (luôn bị che) trong khi một số thật đang nằm cách đó hai trường.

### Cách đối chiếu

`matchesOrderPhones(input, candidates)` (`phone.ts:89-103`):

```
1. normalizePhone(input); rỗng → false
2. known = ứng viên không rỗng
3. real  = known.filter(không bị che)
4. NẾU có bất kỳ số thật nào:
       → CHỈ so khớp TUYỆT ĐỐI, bỏ qua toàn bộ mask nằm cạnh
   NGƯỢC LẠI:
       → fallback: known.some(mask => matchesMask(phone, mask))
```

`matchesMask` (`:45-71`) so **tiền tố + hậu tố**, và từ chối input ngắn hơn tổng phần hiện
(nên `"094"` không thoả `"0****94"`).

`isMasked` (`:39-42`) **fail-closed** — rỗng hoặc null cũng tính là bị che.

### Vòng khép kín

Mask đơn thuần lọt khoảng **1 trên 10 000** số Việt Nam ngẫu nhiên. Nhưng đăng ký thành
công sẽ gọi `updateCustomer` ghi số thật lên POS → bản ghi đó **vĩnh viễn** chuyển sang
đường so khớp tuyệt đối. Test pin hành vi này:
`phone.test.ts:79` — *"stops a mask-compatible impostor once the real number is known"*.

### `normalizePhone` (`:12-19`)

`+84…` → `0` + phần còn lại; `84…` dài ≥ 10 → `0` + phần còn lại; ngược lại chỉ bỏ dấu `+`
ở đầu. Chỉ giữ chữ số và `+`.

---

## 6. Flow cộng điểm hằng ngày (webhook)

`src/app/api/webhooks/pancake/route.ts:61-145`. Đây là **cách duy nhất** điểm được cộng
sau khi đăng ký. Nó không bao giờ tạo được khách mới — không có số điện thoại thật nào để
làm khoá.

```mermaid
sequenceDiagram
    participant P as Pancake POS
    participant W as /api/webhooks/pancake
    participant API as Pancake API
    participant DB as Supabase

    P->>W: POST + x-webhook-secret
    W->>W: verifyWebhookSecret → 401 nếu sai
    W->>W: parse JSON → 422 nếu hỏng
    W->>W: extractOrderId → 422 nếu thiếu
    Note over W: body chỉ là CON TRỎ
    W->>API: getOrder(orderId) — lấy dữ liệu thật
    API-->>W: order | not_found | lỗi
    W->>DB: getActiveSettings → 503 nếu chưa cấu hình
    W->>W: order.status ∈ claimable_statuses?
    W->>DB: isOrderClaimed(canonicalOrderCode)
    W->>DB: getCustomerByPancakeId(customer_id)
    W->>DB: rpc claim_points (service_role)
    DB-->>W: ClaimResult | P0002
    W-->>P: 200 { claimed, points_awarded }
```

### Ba quyết định thiết kế quan trọng

**(a) Body webhook chỉ là con trỏ.** Handler luôn `getOrder()` lại từ Pancake để lấy dữ
liệu thật (`:78-80`). Một payload giả mạo không mua được gì cả — kẻ tấn công chỉ có thể
khiến hệ thống fetch lại một đơn có thật.

**(b) Mã trạng thái HTTP theo ngữ nghĩa retry.** Pancake retry mọi phản hồi non-2xx, nên:

| Tình huống | HTTP | Vì sao |
|---|---|---|
| Sai secret | 401 | Retry vô ích |
| JSON hỏng / thiếu order id | 422 | Retry vô ích |
| **Mọi kết quả nghiệp vụ** (không đủ điều kiện, đã claim, khách lạ) | **200** | Không phải lỗi — retry chỉ tốn tài nguyên |
| Pancake down / chưa cấu hình settings | 503 | **Nên** retry |
| RPC lỗi lạ | 500 | **Nên** retry |

**(c) Dữ liệu định danh lấy từ DB local.** `p_phone`, `p_full_name`, `p_email` truyền vào
RPC đều lấy từ dòng `customers` trong database, **không bao giờ** lấy từ payload Pancake
đã bị che (`:114-126`).

### Bảng lý do bỏ qua (đều trả 200)

| `skipped` | Nghĩa |
|---|---|
| `order_not_found` | Pancake trả 404 hoặc `success: false` |
| `not_eligible` | `order.status` không nằm trong `claimable_statuses` |
| `already_claimed` | Đã có `transactions` row với `order_code` này, hoặc RPC ném `P0002` |
| `unknown_customer` | Đơn không có `customer.customer_id`, hoặc chưa ai đăng ký với id đó |

Phản hồi thành công **chỉ chứa `{ claimed: true, points_awarded }`** — không kèm thông tin
cá nhân, vì Pancake ghi log toàn bộ body webhook (`:140`).

### ⚠️ Không có cửa sổ chống replay

Không kiểm tra delivery-id, không kiểm tra timestamp. Tính idempotent dựa **hoàn toàn** vào:
1. Pre-check `isOrderClaimed()` — có race condition,
2. Unique index `transactions_order_code_uniq` → `P0002` — đây mới là cái chốt thật.

Chỉ export `POST`. Không có `GET`/`HEAD`.

---

## 7. Tính điểm

### Công thức

```
base       = Σ ( qty × (points_awarded[sku] ?? unmapped_sku_points) )   -- bỏ qua qty ≤ 0
raw        = base × multiplier
points     = applyRounding(raw, settings.rounding)   -- floor | round | ceil
```

- `points_awarded` tra từ bảng `product_points` **chỉ với dòng `is_active`**. SKU lạ hoặc
  đã tắt đều rơi về `unmapped_sku_points`.
- SKU lấy từ `items[].variation_info.display_id`.
- **`multiplier` lấy từ hạng TRƯỚC đơn này** (`0011:85-96`) — đơn nâng hạng không được
  hưởng multiplier mới ngay trên chính nó.
- Nếu khách chưa có `tier_id`, fallback về hạng cao nhất mà `lifetime_spend` hiện tại
  thoả — để lần claim đầu tiên không báo một lần "nâng hạng" giả.
- `multiplier` không dương → coi như 1.

### Nghĩa vụ đồng bộ TS ↔ SQL

Cùng một luật được cài **hai lần độc lập**:

| Bản cài | File | Vai trò |
|---|---|---|
| TypeScript | `src/lib/points.ts` — `calcOrderPoints()` | **Chỉ để preview trên UI admin** |
| SQL | `supabase/migrations/0011_claim_spend.sql:99-110` | **Là bản có thẩm quyền** — RPC tính lại phía server |

Sửa một bên mà quên bên kia thì preview và thực tế lệch nhau, không có test nào bắt được.

> Comment ở `src/lib/points.ts:2` vẫn trỏ tới `0003_claim_rpc.sql` — đã lỗi thời, bản có
> thẩm quyền hiện là `0011`. Xem [sổ nợ #7](#17-sổ-nợ-kỹ-thuật).

### Chi tiêu

`orderSpendTotal(order)` (`pancake/client.ts:284-287`):

```
total_price_after_sub_discount ?? total_price ?? 0
→ nếu không hữu hạn hoặc ≤ 0 → 0
```

RPC lại kẹp thêm một lần: `v_spend := greatest(coalesce(p_order_total, 0), 0)` — một đơn
hoàn tiền hoặc số liệu hỏng **không bao giờ được kéo `lifetime_spend` xuống**.

---

## 8. Hệ thống hạng

### Đường đi từ dữ liệu tới giao diện

```mermaid
flowchart LR
    S[customers.lifetime_spend] --> RT[resolveTiers<br/>hạng chi tiêu kiếm được]
    T[customers.tier_id<br/>hạng cao nhất từng đạt] --> RD
    RT --> RD[resolveDisplayTier<br/>lấy CAO HƠN]
    RD --> TP[tierProgress<br/>current/next/floor/percent/toNext]
    TP --> UI[UI]
    RD --> AC[tierRank → tierAccentClass<br/>chọn màu gem theo THỨ HẠNG]
    AC --> UI
```

**UI không bao giờ được dùng hạng thô.** Luôn gọi `resolveDisplayTier` /
`tierProgress(tiers, spend, customer)`.

Bốn nơi gọi: `(account)/layout.tsx:53-55`, `dashboard/page.tsx:66-72`,
`tiers/page.tsx:52-57`, `admin/customers/[id]/page.tsx:108-112`.

### Thang 5 hạng

Định nghĩa ở `0010_spend_tiers.sql` và lặp lại nguyên văn ở `supabase/seed.sql`.

| # | Tên | `spend_threshold` (đồng) | `multiplier` | Màu gem |
|---|---|---|---|---|
| 1 | Bạc | 0 | 1.0 | `--tier-1` bạc `#cbd5e1` |
| 2 | Vàng | 3 000 000 | 1.2 | `--tier-2` vàng `#fbbf24` |
| 3 | Bạch kim | 8 000 000 | 1.5 | `--tier-3` bạch kim `#a5b4fc` |
| 4 | Kim cương | 20 000 000 | 1.8 | `--tier-4` xanh ngọc `#67e8f9` |
| 5 | Ruby | 50 000 000 | 2.0 | `--tier-5` đỏ `#f43f5e` |

Thang cố định 5 hạng — `/admin/tiers` **không có nút thêm hạng**, chỉ sửa. `name` và
`sort_order` là read-only trong form.

Upsert trong `0010` dùng `on conflict (name) do update` nhưng **chỉ ghi đè
`spend_threshold`/`multiplier`/`sort_order`** — `perks` và `benefits` chỉ ghi lúc INSERT,
để chạy lại migration không xoá nội dung shop đã sửa.

### `resolveDisplayTier` — vì sao cần

`loyalty.ts:463-472`. Trả về hạng **cao hơn** giữa hạng đã lưu và hạng chi tiêu hiện tại
kiếm được.

Cần thiết vì ngưỡng chỉ tăng: sau một đợt nâng ngưỡng, một thành viên có
`lifetime_spend = 4tr` từng được cấp hạng Vàng (ngưỡng cũ 3tr) vẫn giữ Vàng dù ngưỡng mới
đã là 5tr. Hạng lưu **vượt mặt** hạng chi tiêu.

### `tierProgress` — đo trong dải, không đo từ 0

`loyalty.ts:494-521`, trả `{ current, next, floor, percent, toNext }`.

- `floor` = `current.spend_threshold` (không phải 0).
- `next` = hạng rẻ nhất **trên `floor`** (không phải trên `spend`) — quan trọng khi hạng
  hiển thị đang cao hơn hạng chi tiêu.
- `percent` = `(spend - floor) / (next.threshold - floor)`, kẹp 0–100, **= 100 ở hạng đỉnh**.
- `toNext` = `max(0, next.threshold - spend)`.

### Nâng ngưỡng theo lịch

Bảng `tier_threshold_schedules` (`0010:101-118`). Mỗi hạng chỉ được có **một** lịch đang chờ
(partial unique index `tier_schedule_one_pending`) — hai lịch xếp hàng sẽ áp theo thứ tự
không ai chọn.

Hai chế độ:

| `mode` | Trường dùng | Nghĩa |
|---|---|---|
| `amount` | `target_amount` | Nâng thẳng lên số đồng này |
| `percentile` | `target_percentile` | "Top N% người chi nhiều nhất" — **giải ra số đồng tại thời điểm áp và đóng băng** vào `resolved_amount` |

`tier_percentile_amount(p)` (`0010:178-191`):

```sql
percentile_disc(1 - clamp(p,0,100)/100) within group (order by lifetime_spend)
from customers where lifetime_spend > 0
```

- Dùng `percentile_disc` **chứ không phải `_cont`** → kết quả luôn là con số của một khách
  hàng có thật, không nội suy.
- **Loại khách chi tiêu 0** — họ không thuộc quần thể được xếp hạng và sẽ kéo mọi phân vị
  về 0.
- Đây chính là lý do **`adjust_points` tuyệt đối không được bịa `lifetime_spend`**: làm thế
  sẽ bóp méo mọi luật phân vị về sau.

`apply_due_tier_schedules()` (`0010:209-284`):

1. Lặp qua `applied_at is null and effective_at <= now()` với `for update skip locked` →
   **idempotent**, một tick cron chạy đua với một lần render `/admin/tiers` không thể áp
   hai lần.
2. Giải ra số tiền đích.
3. Đọc hàng xóm trên/dưới theo `sort_order`.
4. Bốn lý do từ chối:
   - `tier no longer exists`
   - `not an increase`
   - `would fall to or below the tier beneath it`
   - `would reach the tier above it`
5. **Kể cả khi từ chối vẫn đánh dấu `applied_at = now()`** và ghi lý do vào `note` — để
   lịch không bắn lại mãi mãi ở mọi tick.
6. **Không bao giờ đụng `public.customers`** — đó là grandfathering.

Hai nơi gọi:

| Nơi | File | Vai trò |
|---|---|---|
| Cron | `api/cron/tier-schedules/route.ts:33` — cả `GET` lẫn `POST`, đều qua `verifyWebhookSecret` | Đảm bảo lịch áp đúng ngày |
| Render trang | `admin/tiers/actions.ts:187` → được `await` **trước** khi đọc dữ liệu ở `admin/tiers/page.tsx:37` | Dự phòng khi deployment không có cron. Lỗi bị nuốt để trang luôn render |

### Lịch sử hạng

Bảng `customer_tier_history` (`0010:134-145`) giải thích **vì sao** một thành viên đang giữ
hạng mà ngưỡng hiện tại nói họ chưa đạt. `tier_name` và `threshold_amount` là **ảnh chụp**,
không phải join — ngưỡng thời điểm cấp phải được giữ nguyên dù về sau nó đổi.

### Màu gem chọn theo THỨ HẠNG, không theo TÊN

`src/app/(customer)/(account)/tier-accent.ts`. Tên hạng thì admin sửa được và dịch được,
nên không thể làm khoá.

- `tierRank(tiers, tierId)` = vị trí trong danh sách đã sắp theo `spend_threshold`.
- `tierAccentClass(rank)` trả về chuỗi class **viết sẵn nguyên văn** (`ACCENTS[]`, `:15-21`)
  vì Tailwind không thấy được tên class nội suy. Mỗi chuỗi set `[--tier:var(--tier-N)]` +
  một lớp gradient nền.
- `rank` null/âm → `NO_TIER` (xám trung tính). `rank ≥ 5` thì **quay vòng** (`% 5`).
- Component con sau đó chỉ dùng `text-tier`, `border-tier`, `bg-tier/10`, `stroke-tier` mà
  không cần biết mình đang ở hạng nào.

Test: `tier-accent.test.ts:5-45`.

---

## 9. Đổi quà

RPC `redeem_reward(p_customer_id, p_reward_id)` — `0006_redeem_rpc.sql:17-82`.

Thứ tự quan trọng:

```
1. select … from rewards where id = ? and is_active FOR UPDATE   ← KHOÁ TRƯỚC
2. không thấy                → P0001 reward not found
3. quantity <= 0             → P0002 reward out of stock
4. select … from customers FOR UPDATE
5. không thấy                → P0001 customer not found
6. current_points < cost     → P0003 insufficient points
7. insert transactions (type=REDEEM, amount = -cost, source='redeem', reward_id, meta)
8. rewards.quantity -= 1
9. customers.current_points -= cost
```

Khoá dòng quà **trước** khi kiểm tồn là bắt buộc: nếu không, hai lượt đổi đồng thời đều
qua được bước kiểm tra trên món cuối cùng.

**`lifetime_points` cố tình không bị trừ** (`0006:9-10`) — tiêu điểm không được làm tụt
hạng. (Từ `0010` thì hạng đã không còn phụ thuộc `lifetime_points` nữa, nhưng nguyên tắc
vẫn giữ.)

Phía ứng dụng: `src/app/(customer)/(account)/rewards/actions.ts:49`. **Client chỉ gửi được
`rewardId`** — session mới là thứ chứng minh được phép tiêu số dư của ai (`:10-14`). Ánh
xạ lỗi ở `codeFor()` `:42`. Revalidate `/rewards`, `/dashboard`, `/history`.

Trên UI: quà hết hàng **vẫn hiển thị** (làm mờ, không ẩn). Thuộc tính `disabled` trên nút
chỉ là tối ưu phía client — server luôn kiểm lại (`reward-card.tsx:50`).
`EXCLUSIVE_CATEGORY = "exclusive"` là một **pseudo-category**: nó lọc theo cột
`is_exclusive`, không phải cột `category` (`loyalty.ts:209`).

---

## 10. Điều chỉnh thủ công (admin)

RPC `adjust_points(p_customer_id, p_current_delta, p_lifetime_delta, p_grant_tier_id, p_reason, p_actor)` —
`0012_adjust_tier_direct.sql:19-139`. Đường ghi duy nhất cho một dòng `ADJUST`.

### Vì sao tồn tại

Pancake che số điện thoại ở **mọi** endpoint — kể cả `orders/list` cũng trả `0****89`.
Nghĩa là **không thể backfill lịch sử mua hàng** của một khách quen. Nhân viên buộc phải
chỉnh số dư bằng tay, và việc đó phải để lại vết.

### Logic

1. `p_reason` rỗng → `P0001 'reason required'`.
2. `select … from customers FOR UPDATE` — khoá suốt cả thao tác, để một lượt đổi quà đồng
   thời không chen được vào giữa lúc đọc và lúc ghi.
3. Nếu có `p_grant_tier_id`: chỉ **cấp lên** — điều kiện `v_old_thr is null or v_grant_thr > v_old_thr`.
   **So bằng `spend_threshold`, không phải `sort_order`** (`sort_order` là số tự do admin gõ).
4. Không có gì thay đổi → `P0005 'no-op adjustment'` (errcode riêng vì nguyên nhân hay gặp
   nhất là chọn một hạng khách đã vượt).
5. Điểm âm sau điều chỉnh → `P0003 'insufficient points'` — báo ở đây để form nói "không đủ
   điểm" thay vì lộ ra lỗi 23514 thô của CHECK constraint.
6. Ghi dòng `ADJUST` với `amount = p_current_delta` — **chỉ dòng tiền khả dụng**, vì đó là
   thứ màn hình giao dịch cộng lại. Một lần cấp hạng thuần tuý ghi `amount = 0` và để chi
   tiết trong `meta`.
7. Ghi `customers.tier_id` **trực tiếp**.
8. **Tuyệt đối không đụng `lifetime_spend`** (`0012:112-113`) — một hạng được cấp là một
   quyết định, không phải doanh thu; bịa chi tiêu sẽ làm hỏng mọi phân vị.

### Khác biệt so với bản `0008`

Cùng chữ ký hàm (nên `0012` chỉ là `create or replace`), nhưng đổi hoàn toàn ý nghĩa của
`p_grant_tier_id`:

| | `0008` | `0012` |
|---|---|---|
| Cách cấp hạng | Nâng `lifetime_points` lên bằng `threshold` của hạng đó, để hạng tự suy ra | Ghi thẳng `customers.tier_id` |
| Vì sao đổi | `claim_points` khi đó tính lại `tier_id` từ `lifetime_points` ở mỗi đơn → sẽ xoá sạch hạng cấp tay | Từ `0010`/`0011`, `tier_id` đã sticky nên hạng cấp tay tồn tại được |

Trên UI: `adjust-form.tsx` chỉ cho chọn hạng **cao hơn** hạng đang giữ, lọc theo threshold
(`:88-96`), kèm preview số dư sau điều chỉnh (`:81-83`).

---

## 11. Schema database

```mermaid
erDiagram
    membership_tiers ||--o{ customers : "tier_id (RESTRICT)"
    membership_tiers ||--o{ tier_threshold_schedules : "tier_id (CASCADE)"
    membership_tiers ||--o{ customer_tier_history : "tier_id (SET NULL)"
    customers ||--o{ transactions : "customer_id (CASCADE)"
    customers ||--o{ customer_tier_history : "customer_id (CASCADE)"
    customers ||--o{ support_requests : "customer_id (SET NULL)"
    rewards ||--o{ transactions : "reward_id (SET NULL)"
    auth_users ||--o| customers : "auth_user_id (SET NULL)"
    product_points }|..|| transactions : "tra cứu lúc claim"
    loyalty_settings }|..|| transactions : "cấu hình lúc claim"
    claim_attempts }o..o{ customers : "chống brute-force theo IP"
```

**Trong toàn schema: không có trigger nào, không có view nào.** Mọi giá trị dẫn xuất
(`current_points`, `lifetime_points`, `lifetime_spend`, `tier_id`, `updated_at`) đều được
ghi tay bên trong RPC. Không có lưới an toàn nếu một đường ghi mới quên một cột.

### 11.1 `membership_tiers`

Định nghĩa 5 hạng.

| Cột | Kiểu | Default | Ràng buộc |
|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | PK |
| `name` | text | | NOT NULL, UNIQUE |
| `spend_threshold` | numeric(14,0) | | NOT NULL, UNIQUE, `>= 0` |
| `multiplier` | numeric | 1 | NOT NULL, `> 0` |
| `sort_order` | integer | 0 | NOT NULL |
| `benefits` | text | | nullable (free text cũ) |
| `perks` | jsonb | `'[]'` | NOT NULL, `jsonb_typeof = 'array'` |
| `created_at` | timestamptz | `now()` | NOT NULL |

`perks` có dạng `[{"icon":"percent","title":"…","detail":"…"}]`. Bộ icon hợp lệ:
`PERK_ICON_KEYS` ở `src/lib/tier-perks.ts:7` — `percent, gift, truck, cake, award, sparkles`.
Tối đa `MAX_PERKS = 6`.

> Cột này vốn tên `threshold integer`. `0010` đổi tên + đổi kiểu trong một khối `DO` có
> guard. **Ràng buộc UNIQUE và CHECK đi theo cột nhưng vẫn giữ tên tự sinh cũ**
> (`membership_tiers_threshold_key`, `membership_tiers_threshold_check`).

### 11.2 `customers`

Thành viên. Khoá tự nhiên là `phone`, không phải `auth_user_id` — vì webhook có thể cộng
điểm cho một số điện thoại trước khi người đó đăng ký.

| Cột | Kiểu | Default | Ràng buộc |
|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | PK |
| `auth_user_id` | uuid | | UNIQUE, FK → `auth.users(id)` ON DELETE **SET NULL** |
| `phone` | text | | NOT NULL, **UNIQUE** — khoá tự nhiên |
| `email` | text | | nullable |
| `full_name` | text | | nullable |
| `date_of_birth` | date | | nullable |
| `pet_name` | text | | nullable |
| `pet_type` | text | | nullable, ∈ `('dog','cat','other')` |
| `pet_dob` | date | | nullable |
| `profile_completed_at` | timestamptz | | nullable — lần lưu đầu tiên thắng, sửa sau không reset |
| `pancake_customer_id` | text | | nullable — **khoá liên kết với POS**, UNIQUE khi khác NULL |
| `current_points` | integer | 0 | NOT NULL, `>= 0` |
| `lifetime_points` | integer | 0 | NOT NULL, `>= 0` |
| `lifetime_spend` | numeric(14,0) | 0 | NOT NULL, `>= 0` — đồng vượt `int4` |
| `tier_id` | uuid | | FK → `membership_tiers(id)` ON DELETE **RESTRICT** — xoá hạng là tụt hạng, phải nổ thay vì âm thầm |
| `created_at` / `updated_at` | timestamptz | `now()` | NOT NULL, `updated_at` ghi tay |

### 11.3 `transactions`

Sổ cái **append-only**. Không có đường UPDATE hay DELETE nào trong bất kỳ RPC hay policy nào.

| Cột | Kiểu | Default | Ràng buộc |
|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | PK |
| `customer_id` | uuid | | NOT NULL, FK → `customers(id)` ON DELETE **CASCADE** |
| `phone` | text | | NOT NULL — ảnh chụp, để dòng còn tra được sau khi khách bị xoá |
| `type` | text | | NOT NULL, ∈ `('EARN','REDEEM','ADJUST')` |
| `amount` | integer | | NOT NULL, có dấu (EARN +, REDEEM −, ADJUST cả hai) |
| `order_code` | text | | nullable — chỉ dòng EARN có |
| `source` | text | `'claim'` | NOT NULL, ∈ `('claim','webhook','admin','redeem')` |
| `reward_id` | uuid | | FK → `rewards(id)` ON DELETE SET NULL |
| `meta` | jsonb | | nullable |
| `created_at` | timestamptz | `now()` | NOT NULL |

`meta` theo từng nơi ghi:

| Ghi bởi | Nội dung `meta` |
|---|---|
| `claim_points` | `{items, multiplier, base, order_total}` |
| `redeem_reward` | `{reward_name, points_cost}` |
| `adjust_points` | `{reason, actor:{id,email}, current_delta, lifetime_delta, granted_tier_id}` |

Đọc `meta` của dòng ADJUST bằng `adjustMeta()` (`loyalty.ts:28`) — hàm này **dò** chứ không
khẳng định kiểu, số không hợp lệ về 0.

### 11.4 `rewards`

| Cột | Kiểu | Default | Ràng buộc |
|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | PK |
| `name` | text | | NOT NULL |
| `description` | text | | nullable |
| `points_cost` | integer | | NOT NULL, `>= 0` |
| `quantity` | integer | 0 | NOT NULL, `>= 0` |
| `image_url` | text | | nullable |
| `category` | text | | nullable, slug tự do — tab bar dựng từ các giá trị distinct |
| `is_exclusive` / `is_featured` / `is_active` | boolean | false/false/true | NOT NULL |
| `created_at` | timestamptz | `now()` | NOT NULL |

`LOW_STOCK = 5` (`src/lib/rewards.ts:10`) dùng chung cho chip phía khách, hàng stat admin
và tile dashboard admin — để ba chỗ không trôi khỏi nhau.

### 11.5 `product_points`

Bảng ánh xạ SKU → điểm.

| Cột | Kiểu | Default | Ràng buộc |
|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | PK |
| `product_code` | text | | NOT NULL, UNIQUE — khớp `items[].variation_info.display_id` |
| `label` | text | | nullable |
| `points_awarded` | integer | 0 | NOT NULL, `>= 0` |
| `is_active` | boolean | true | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL |

### 11.6 `loyalty_settings`

Cấu hình đơn lẻ. Nhiều nhất một dòng `is_active` (partial unique index).

| Cột | Kiểu | Default | Ràng buộc |
|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | PK |
| `rounding` | text | `'floor'` | NOT NULL, ∈ `('floor','round','ceil')` |
| `claimable_statuses` | integer[] | `'{3,16}'` | NOT NULL — mã trạng thái Pancake được tính điểm |
| `unmapped_sku_points` | integer | 0 | NOT NULL, `>= 0` |
| `is_active` | boolean | false | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL |

Mã trạng thái: `3` = đã giao, `16` = đã nhận tiền
(`DEFAULT_CLAIMABLE_STATUSES = [3, 16]`, `src/lib/pancake/order-status.ts:21`).

### 11.7 `claim_attempts`

Bộ đếm chống brute-force. Nằm trong Postgres vì các instance serverless không chia sẻ bộ nhớ.

| Cột | Kiểu | Default |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` (PK) |
| `ip` | text | NOT NULL |
| `order_code` | text | nullable |
| `succeeded` | boolean | false, NOT NULL |
| `created_at` | timestamptz | `now()`, NOT NULL |

Tham số ở `src/lib/rate-limit.ts:12-14`: cửa sổ **15 phút**, **5 lần thất bại** mỗi IP,
5 lần mỗi mã đơn.

`getClientIp()` lấy phần tử đầu của `x-forwarded-for`, rồi `x-real-ip`, rồi `"unknown"` —
nghĩa là **mọi request không xác định được IP đều dùng chung một xô**.

### 11.8 `support_requests`

| Cột | Kiểu | Default | Ràng buộc |
|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | PK |
| `customer_id` | uuid | | FK → `customers(id)` ON DELETE SET NULL |
| `name` / `email` / `topic` / `message` | text | | NOT NULL |
| `status` | text | `'open'` | NOT NULL, ∈ `('open','closed')` |
| `created_at` | timestamptz | `now()` | NOT NULL |

Chủ đề: `SUPPORT_TOPICS` (`src/lib/schemas.ts:243`) — `points, rewards, account, bug,
feature, other`.

**Cố tình không có INSERT policy cho khách** — Server Action chèn bằng service-role client
sau khi tự giải `customer_id` **từ session**, không lấy từ payload
(`(account)/help/actions.ts:9-12`).

### 11.9 `tier_threshold_schedules`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | uuid | PK |
| `tier_id` | uuid | NOT NULL, FK → `membership_tiers(id)` ON DELETE **CASCADE** |
| `mode` | text | NOT NULL, ∈ `('amount','percentile')` |
| `target_amount` | numeric(14,0) | nullable |
| `target_percentile` | numeric(5,2) | nullable |
| `resolved_amount` | numeric(14,0) | nullable — ghi lúc áp, là dấu vết "top 5% ngày đó nghĩa là bao nhiêu" |
| `effective_at` | timestamptz | NOT NULL |
| `applied_at` | timestamptz | nullable — NULL nghĩa là đang chờ |
| `note` | text | nullable — lý do skip nối vào đây |
| `created_by` | uuid | nullable, **không có FK** |
| `created_at` | timestamptz | `now()`, NOT NULL |

CHECK cấp bảng buộc đúng một cặp trường được điền:

```sql
check ((mode = 'amount'     and target_amount     is not null and target_amount >= 0)
    or (mode = 'percentile' and target_percentile is not null
        and target_percentile > 0 and target_percentile < 100))
```

### 11.10 `customer_tier_history`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid | PK |
| `customer_id` | uuid | NOT NULL, FK CASCADE |
| `tier_id` | uuid | FK SET NULL |
| `tier_name` | text | NOT NULL — **ảnh chụp**, không join |
| `threshold_amount` | numeric(14,0) | NOT NULL — **ảnh chụp** ngưỡng thời điểm cấp |
| `spend_at_award` | numeric(14,0) | NOT NULL |
| `source` | text | NOT NULL, ∈ `('claim','webhook','admin')` — **không có `'redeem'`** |
| `awarded_at` | timestamptz | `now()`, NOT NULL |

### 11.11 Index — năm cái mang luật nghiệp vụ

| Index | Định nghĩa | Vì sao quan trọng |
|---|---|---|
| **`transactions_order_code_uniq`** | `unique (order_code) where order_code is not null` | **Hàng phòng ngự duy nhất chống cộng trùng.** Dùng chung bởi flow đăng ký và webhook |
| **`customers_pancake_idx`** | `unique (pancake_customer_id) where pancake_customer_id is not null` | Một POS customer chỉ thuộc về một tài khoản. Thiếu nó, hai lần đăng ký đồng thời cùng lọt cổng ở `auth/actions.ts`, `maybeSingle()` vỡ vì nhiều dòng, và khách đó vô hình trước webhook vĩnh viễn |
| **`loyalty_settings_one_active`** | `unique (is_active) where is_active` | Nhiều nhất một dòng cấu hình đang bật |
| **`rewards_one_featured`** | `unique ((true)) where is_featured and is_active` | Đúng một món được lên hero. Ép ở DB thay vì để UI tự chọn bừa |
| **`tier_schedule_one_pending`** | `unique (tier_id) where applied_at is null` | Một lịch chờ mỗi hạng |

Index còn lại (thuần hiệu năng): `transactions_customer_idx`,
`transactions_phone_idx`, `claim_attempts_ip_idx`, `claim_attempts_order_idx`,
`rewards_category_idx`, `support_requests_customer_idx`, `support_requests_open_idx`,
`tier_schedule_due_idx`, `customer_tier_history_customer_idx`.

### 11.12 RLS

Bật trên **cả 10 bảng**. `service_role` bypass hoàn toàn — đó là lý do mọi đường ghi ở trên
đều là service-role.

> **GRANT đi trước RLS.** Postgres kiểm quyền bảng **trước**, chỉ khi qua mới xét policy.
> Không có `grant` thì policy viết đẹp đến đâu cũng không bao giờ được chạm tới —
> đúng tình trạng của repo này cho tới `0013_grants.sql`. Quy tắc: **GRANT quyết định
> động từ nào được thử, RLS quyết định dòng nào trả về.** Thêm policy mới thì phải thêm
> grant tương ứng trong `0013`, nếu không nó là code chết.
>
> | Role | Được cấp |
> |---|---|
> | `anon` | SELECT trên `membership_tiers`, `rewards` — đúng hai bảng có policy cho anon |
> | `authenticated` | SELECT trên 10 bảng (RLS lọc dòng); INSERT/UPDATE/DELETE trên `rewards`, `product_points`, `loyalty_settings`, `support_requests`, `tier_threshold_schedules`; **chỉ UPDATE** trên `membership_tiers` và `customers` |
> | `service_role` | ALL trên mọi bảng + sequence. `BYPASSRLS` **không** thay được grant |

| Bảng | Policy | Lệnh | Role | USING |
|---|---|---|---|---|
| `membership_tiers` | read tiers | SELECT | anon, auth | `true` |
| `membership_tiers` | admin update tiers | **UPDATE** | auth | `is_admin()` |
| `rewards` | read active rewards | SELECT | anon, auth | `is_active or is_admin()` |
| `rewards` | admin manage rewards | ALL | auth | `is_admin()` |
| `loyalty_settings` | admin manage settings | ALL | auth | `is_admin()` |
| `product_points` | admin manage product points | ALL | auth | `is_admin()` |
| `customers` | customer reads own row | SELECT | auth | `auth_user_id = auth.uid() or is_admin()` |
| `customers` | admin update customers | UPDATE | auth | `is_admin()` |
| `transactions` | customer reads own transactions | SELECT | auth | `is_admin() or customer_id in (…auth.uid())` |
| `claim_attempts` | admin read claim attempts | SELECT | auth | `is_admin()` |
| `support_requests` | read support requests | SELECT | auth | `is_admin() or customer_id in (…)` |
| `support_requests` | admin manage support requests | ALL | auth | `is_admin()` |
| `tier_threshold_schedules` | admin manage tier schedules | ALL | auth | `is_admin()` |
| `customer_tier_history` | read own tier history | SELECT | auth | `is_admin() or customer_id in (…)` |

**Những vắng mặt đều có chủ ý:**

- **Không có policy `for insert` riêng nào** — nhưng các policy `for all` ở trên **bao gồm cả
  INSERT** cho admin. Phát biểu đúng hẹp hơn: `customers`, `transactions`, `claim_attempts`,
  `customer_tier_history` **không có đường ghi trực tiếp** nào; chúng chỉ đổi qua RPC hoặc
  service-role.
- `product_points` **và `loyalty_settings`** không cho anon đọc — ánh xạ SKU→điểm, làm tròn,
  điểm SKU lạ và tập trạng thái tính điểm đều là cấu hình kinh doanh. Luồng claim đọc chúng
  bằng service-role, nên không có consumer anon nào.
- `membership_tiers` **chỉ có UPDATE**, không phải `for all`: xoá một hạng là tụt hạng tập thể
  cho mọi người đang giữ nó. Thang 5 hạng cố định nên cũng không cần INSERT.
- `customers` không có INSERT lẫn DELETE policy.
- `transactions` **chỉ có SELECT** — sổ cái chỉ ghi thêm qua RPC.

### 11.13 Danh mục RPC

| RPC | Migration | Cấp cho | SECURITY DEFINER |
|---|---|---|---|
| `is_admin()` | `0005` | **`anon, authenticated, service_role`** | ✅ |
| `claim_points(...)` 8 tham số | `0011` | `service_role` | ✅ |
| `redeem_reward(uuid, uuid)` | `0006` | `service_role` | ✅ |
| `update_customer_profile(...)` | `0007` | `service_role` | ✅ |
| `adjust_points(...)` | `0012` | `service_role` | ✅ |
| `find_orphan_auth_user(text)` | `0009` | `service_role` | ✅ |
| `tier_percentile_amount(numeric)` | `0010` | `service_role` | ✅ |
| `apply_due_tier_schedules()` | `0010` | `service_role` | ✅ |

Tất cả đều `set search_path = public`.

### 11.14 Từ điển errcode

Dùng nhất quán trên mọi RPC:

| Code | Nghĩa | Xuất hiện ở |
|---|---|---|
| `P0001` | Input xấu / không tìm thấy | mọi RPC |
| `P0002` | Đã claim / hết hàng | `claim_points`, `redeem_reward` |
| `P0003` | Không đủ điểm | `redeem_reward`, `adjust_points` |
| `P0004` | Chưa có cấu hình loyalty đang bật | `claim_points` |
| `P0005` | Điều chỉnh không thay đổi gì | `adjust_points` |
| `23505` | (Postgres) vi phạm unique — được map thành lỗi thân thiện ở tầng action | `saveReward`, `saveProductPoint`, `saveTierSchedule` |

### 11.15 `seed.sql`

Đơn hàng **không** được seed. Nội dung:

- 5 hạng — trùng thang trong `0010`, chép nguyên văn để `db reset` đọc thành một mạch
  (dùng `do nothing` thay vì `do update`).
- 1 dòng `loyalty_settings`: `('floor', '{3,16}', 0, true)` — 3 = đã giao, 16 = đã nhận tiền.
- 2 SKU thật của shop: `SP000001` "Cát sắn Chicha 2,5kg" → 50 điểm;
  `STPLCHODNC500` "Sữa tắm Purodora 500ml" → 100 điểm.
- 3 phần quà: `Voucher 50.000đ` (500đ), `Túi cát 2,5kg` (1500, giá cũ 1800, **featured**),
  `Combo chăm sóc` (4000, **exclusive**).

---

## 12. Changelog 13 migration

| # | File | Thêm gì / vì sao |
|---|---|---|
| 0001 | `schema` | Schema gốc. Bật `pgcrypto`. Xoá hẳn phiên bản trước (`orders`, `point_transactions`, …) → **xác lập tư thế "không lưu đơn hàng"**. Tạo 7 bảng + 7 index. Lúc này `threshold` đo với `lifetime_points` |
| 0002 | `rls` | Bật RLS + 11 policy. Tư thế lúc đó: `anon` = đọc; `authenticated` = **admin** (`using true`), vì chưa có tài khoản khách |
| 0003 | `claim_rpc` | `claim_points` 6 tham số. **Điểm tính bên trong DB** từ `product_points` — caller chỉ đưa SKU/qty, không bao giờ đưa số điểm |
| 0004 | `claim_source` | Thêm `p_source` để webhook ghi `'webhook'`. Drop overload cũ (nếu để lại, tham số có default sẽ khiến mọi lời gọi thành nhập nhằng) |
| 0005 | `roles_and_customer_rls` | **Tách admin/khách.** Backfill `role='admin'` cho mọi `auth.users` có sẵn **trước khi** siết policy. Thêm `is_admin()`. Viết lại toàn bộ 11 policy: đọc mở cho anon, ghi gác bằng `is_admin()`, `customers`/`transactions` có đường đọc tự-thân qua `auth.uid()` |
| 0006 | `redeem_rpc` | Mở rộng `transactions_source_check` thêm `'redeem'`. Thêm `redeem_reward` với `FOR UPDATE` trước khi kiểm tồn |
| 0007 | `profile_catalog_support` | Một đợt UI, bốn mảng: (1) `customers` thêm DOB + thông tin thú cưng; (2) `rewards` thêm `category`/`is_exclusive`/`is_featured` + index `rewards_one_featured`; (3) `membership_tiers.perks`; (4) bảng `support_requests`. Thêm `update_customer_profile` |
| 0008 | `adjust_rpc` | `adjust_points` — đường ghi duy nhất cho dòng ADJUST. Cấp hạng bằng cách nâng `lifetime_points` |
| 0009 | `orphan_signup` | `find_orphan_auth_user` — cứu một lần đăng ký chết giữa chừng khiến alias email bị chiếm vĩnh viễn. `auth.users` không với tới được qua PostgREST nên phải làm RPC |
| 0010 | `spend_tiers` | **Hạng chuyển từ ĐIỂM sang CHI TIÊU.** Migration lớn nhất: thêm `lifetime_spend`; đổi tên `threshold`→`spend_threshold` + đổi kiểu; nạp thang 5 hạng đồng; thêm `tier_threshold_schedules` + `customer_tier_history`; thêm `tier_percentile_amount` + `apply_due_tier_schedules`. Khách cũ bắt đầu từ `lifetime_spend = 0` (lịch sử không backfill được) nhưng **giữ hạng** nhờ tính sticky |
| 0011 | `claim_spend` | `claim_points` v3 + `p_order_total`. `lifetime_spend` cộng dồn (kẹp `>= 0`). Hạng tra theo `spend_threshold` và **sticky** — chỉ nhận nâng khi ngưỡng mới **lớn hơn hẳn**. Ghi `customer_tier_history` khi nâng |
| 0012 | `adjust_tier_direct` | `adjust_points` v2 (cùng chữ ký, `create or replace`): `p_grant_tier_id` giờ ghi thẳng `customers.tier_id`. Thổi phồng `lifetime_points` để giả hạng giờ đã sai hẳn, vì `lifetime_spend` là doanh thu thật mà `tier_percentile_amount()` xếp hạng trên đó |
| 0013 | `grants` | **Quyền bảng cho các role của PostgREST.** Trước file này không migration nào `grant` bao giờ: DB dựng thuần từ `migrations/` trả `permission denied` cho **cả** `anon`, `authenticated` lẫn `service_role`, và toàn bộ RLS ở trên chưa từng được chạm tới — Postgres kiểm quyền trước, không bao giờ đi tới policy. Ẩn được lâu vì default privileges của Supabase cho role `postgres` trong `public` chỉ là `Dxtm` (không SELECT/INSERT/UPDATE/DELETE); project cũ dựng từ thời default còn là `ALL` nên vẫn chạy. GRANT quyết định **động từ**, RLS quyết định **dòng** — thêm policy mới phải thêm grant tương ứng |

---

## 13. Inventory route & Server Action

### Trang

| Route | File | Query param |
|---|---|---|
| `/` | `src/app/page.tsx:6` | — (redirect `/login`) |
| `/login` | `(customer)/login/page.tsx:12` | — |
| `/register` | `(customer)/register/page.tsx:12` | — |
| `/dashboard` | `(account)/dashboard/page.tsx:43` | — |
| `/rewards` | `(account)/rewards/page.tsx:22` | `category` |
| `/tiers` | `(account)/tiers/page.tsx:44` | — |
| `/history` | `(account)/history/page.tsx:42` | `page`, `q`, `from`, `to` |
| `/help` | `(account)/help/page.tsx:15` | — |
| `/profile` | `(account)/profile/page.tsx:13` | — |
| `/admin` | `admin/page.tsx:52` | — |
| `/admin/login` | `admin/login/page.tsx:10` | — |
| `/admin/tiers` | `admin/tiers/page.tsx:29` | — |
| `/admin/products` | `admin/products/page.tsx:28` | — |
| `/admin/rewards` | `admin/rewards/page.tsx:20` | `q` |
| `/admin/customers` | `admin/customers/page.tsx:37` | `page`, `q` |
| `/admin/customers/[id]` | `admin/customers/[id]/page.tsx:56` | `page` |
| `/admin/transactions` | `admin/transactions/page.tsx:53` | `page`, `q`, `from`, `to`, `type`, `source` |
| `/admin/settings` | `admin/settings/page.tsx:16` | — |
| `/admin/support` | `admin/support/page.tsx:38` | `page`, `status` |

Layout & boundary: `app/layout.tsx:31` (font, i18n, theme, Tooltip, Toaster),
`(account)/layout.tsx:23`, `admin/layout.tsx:17`, cùng `error.tsx` + `loading.tsx` ở cả hai
portal.

### API route

| Route | File | Method | Xác thực |
|---|---|---|---|
| `/api/cron/tier-schedules` | `route.ts:17,25` | POST **và** GET | `verifyWebhookSecret` |
| `/api/webhooks/pancake` | `route.ts:61` | POST | `verifyWebhookSecret` |

### Server Action

| File | Action |
|---|---|
| `(customer)/auth/actions.ts` | `signIn`, `signUp`, `signOut` |
| `(account)/rewards/actions.ts` | `redeemReward` |
| `(account)/profile/actions.ts` | `saveProfile` |
| `(account)/help/actions.ts` | `submitSupportRequest` |
| `admin/login/actions.ts` | `login`, `logout` |
| `admin/settings/actions.ts` | `saveSettings` |
| `admin/products/actions.ts` | `saveProductPoint`, `deleteProductPoint` |
| `admin/rewards/actions.ts` | `saveReward`, `deleteReward` |
| `admin/tiers/actions.ts` | `saveTier`, `saveTierSchedule`, `cancelTierSchedule`, `previewPercentileAmount`, `applyDueTierSchedules` |
| `admin/support/actions.ts` | `setSupportStatus` |
| `admin/customers/[id]/actions.ts` | `adjustPoints` |

### Vài ghi chú theo trang

- **`/admin`** — 6 stat tile; phần phân bố theo hạng chạy **một query đếm cho mỗi hạng**
  (N+1 có chủ ý, N ≤ 5, `page.tsx:107-115`).
- **`/admin/products`** — fetch catalog variation từ Pancake song song và **degrade êm ái**
  khi Pancake chết (`.catch(() => null)`, `:39`).
- **`/admin/customers`** — sắp theo **`lifetime_spend` desc**, tìm kiếm
  `or(phone.ilike, full_name.ilike)`.
- **`/admin/transactions`** — giá trị `type`/`source` lạ trên URL được coi như "không lọc".
  `getAdminTransactions` chạy predicate lọc **hai lần** (trang hiện tại + tổng toàn bộ tập
  lọc) — có chủ ý, ghi ở `loyalty.ts:363`.
- **`/history`** — dùng **một `<form action="/history">` method GET** cho ô tìm + khoảng
  ngày, nên không cần client component nào. Mã hiển thị `TXN-/RDM-XXXXXX` **suy ra từ `id`**
  vì sổ cái không có cột nào như vậy (`:202-207`).
- **`/tiers`** — render cả năm mockup thành viên từ **một route duy nhất**. Số điện thoại
  được che ngay trong trang: `phone.replace(/^(\d{2})\d+(\d{2})$/, "$1••••$2")` (`:79`).
  `MemberCardDialog` thuần trình bày — **không có barcode hay pass thật**.
- **`getAccount()`** (`(account)/account.ts:20`) — cổng chung của cả nhóm route. Nếu thiếu
  dòng `customers` (đăng ký chết giữa `createUser` và bước link), nó **tự chạy lại**
  `linkAuthUserToPhone` từ `user_metadata.phone` (`:32-38`). **Caller phải xử lý được
  `customer: null`** — mọi trang đều `return null`, layout render thông báo + nút đăng xuất.

---

## 14. i18n & Theme

Hai stack song song, cùng kiểu: cookie → server đọc → provider truyền xuống client.

### i18n (`src/lib/i18n/`)

- Locale: `["vi", "en"]`, mặc định **`vi`**. Cookie `NEXT_LOCALE`.
- **Không routing theo URL, không có nút đổi ngôn ngữ trên giao diện.**
- `en.ts` (784 dòng) là **nguồn sự thật**; `vi.ts` khai báo `: Messages` nên `tsc` ép parity
  → thêm key một bên mà quên bên kia là **fail `npm run typecheck` / `npm run build`**.
- Nhiều entry là **hàm**, không phải chuỗi (`m.percentileLabel(pct)`, `d.greeting(name)`,
  `r.cost(n)`). Đó là lý do catalog **không thể** vượt ranh giới RSC → `I18nProvider` chỉ
  truyền **chuỗi locale**, client tự chọn catalog từ map đã bundle.
- Zod schema **dựng theo từng request** từ `t.validation` (`src/lib/schemas.ts:6-9`) — các
  factory `makeXSchema(v)`, type được infer nên caller vẫn có static type.
- Ngày tháng: `Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", …)`.
  **Tiền tệ luôn `vi-VN`** bất kể locale UI (`formatVnd`, `src/lib/utils.ts:30-39`).
- `<html lang={locale}>` ở `app/layout.tsx:40`; font Hanken Grotesk nạp subset
  `"vietnamese"` vì vi là mặc định.

### Theme (`src/lib/theme/`)

- Cookie `theme`, max-age 1 năm. `getTheme()` trả `Theme | null` — **`null` = chưa quyết**,
  fallback theo OS.
- `themeForDob(dob)`: `LIGHT_THEME_MIN_AGE = 30` → từ 30 tuổi trở lên seed **light**, còn
  lại **dark**. Null/không hợp lệ → dark.
- `theme-init-script.tsx` chạy trước paint để tránh nháy — **chỉ render khi `theme === null`**.
- Seed lúc đăng ký (`auth/actions.ts:276`, vô điều kiện) và lúc đăng nhập **chỉ khi chưa có
  lựa chọn nào** (`:80-83`).

---

## 15. Design system

Hệ "Chicha Pet Members". Bản vẽ gốc: `design/stitch-v2/` (README + 11 mockup HTML + PNG).

### `src/app/globals.css`

**Cạm bẫy build phải biết:**

```css
@source not "../../design";   /* :9 */
```

Thiếu dòng này, Tailwind sẽ biên dịch các class arbitrary trong mockup CDN và **build fail
ở các tham chiếu `url()` của chúng**.

- `@theme inline` (`:20-119`) ánh xạ mọi `--color-*` sang biến trong `:root`. Ngoài bộ
  shadcn chuẩn còn có: `surface-low/-container/-high/-highest`, `outline`, `chicha-blue`,
  `brand`, `destructive-container`, `success`, `warning`, `secondary-container`,
  `primary-container`, và họ `--color-tier` + `--color-tier-1..5`.
- **Thang bo góc**: `sm 6px, md 8px, lg 12px, xl 1rem, 2xl 1.25rem, 3xl 2rem, 4xl 3rem`.
  Chiều sâu đến từ lớp tông màu + viền 1px, **không bao giờ từ shadow**.
- **Thang chữ ngữ nghĩa** (`:88-118`) — markup đọc như bản spec:
  `text-display` 48/56 · `text-headline-lg` 30/38 · `text-headline-md` 20/28 ·
  `text-body-lg` 16/24 · `text-body-sm` 14/20 · `text-body-xs` 12/16 ·
  `text-label-sm` 10/14 · `text-label-md` 12/16. Override cho màn hình điện thoại ở `:329-339`.
- **Dark là baseline** (`:121-183`): canvas `#10131a`, card `#1d2027`. Tier:
  `--tier-1 #cbd5e1` bạc · `-2 #fbbf24` vàng · `-3 #a5b4fc` bạch kim · `-4 #67e8f9` Kim cương ·
  `-5 #f43f5e` Ruby. Comment `:165-166` nói rõ **không được hoán đổi 4 và 5**.
- **Light là override** (`:185-305`) — cùng tên token, nhân đôi ở hai selector cố tình giữ
  đồng bộ: `@media (prefers-color-scheme: light) :root:not([data-theme])` và
  `:root[data-theme="light"]`. Chú ý `--primary` **đảo vai**: tông nhạt trên nền tối,
  `#0049ed` bão hoà trên nền sáng.

**Quy tắc:** tên token kế thừa từ hệ light cũ, nên trang dùng `bg-card`,
`text-muted-foreground` — **không bao giờ viết hex trực tiếp**.

`cn()` (`src/lib/utils.ts:10-24`) **mở rộng twMerge** một nhóm class `font-size` cho các
`text-headline-lg` v.v. — nếu không, tailwind-merge xếp chúng vào nhóm text-COLOR và âm
thầm nuốt mất màu chữ thật.

### Base UI, không phải Radix

**Button không có `asChild`.** Muốn một `Link` trông như button thì dùng `buttonVariants`
(mẫu ở `src/components/page-link.tsx`).

Khác biệt cục bộ khác: `button.tsx` có thêm variant `muted` và size `icon-sm`;
`form.tsx` export helper `fieldValue()` dùng cho mọi field số; `input.tsx` hỗ trợ prop
`icon` và **phải forward toàn bộ props** (FormControl clone `id`/`aria-*` xuống nó);
`progress.tsx` có mode `accent` đọc `--tier`; `select.tsx` nhận **cả** prop `items` **và**
children (yêu cầu của Base UI).

### Component dùng chung (`src/components/`, 18 file)

| Component | Vai trò |
|---|---|
| `AuthSplit` | Màn hình auth chia đôi, dùng chung `/login`, `/register`, `/admin/login` |
| `ConfirmDelete` | Nút xoá + xác nhận, nhận một server action đã bind |
| `EmptyState` | Placeholder giữa khung |
| `FieldLegend` | Chú thích cột, hiện một lần mỗi trang |
| `FormDialog` | Giữ state mở/đóng, đưa `close` cho form — lưu lỗi thì dialog vẫn mở |
| `FormError` | Banner lỗi; không render gì khi message null |
| `InitialsAvatar` | Vòng tròn 2 chữ cái từ tên/SĐT/email |
| `PageHeader` | Tiêu đề + phụ đề + eyebrow + slot phải |
| `PageLink` | Nút phân trang; thành `<span>` mờ khi không có đích. **Đây là mẫu `buttonVariants`-trên-Link** |
| `PageSkeleton` | Khung mà `loading.tsx` render |
| `Pagination` | "hiển thị N / M" + prev/next |
| `PortalNav` | **Dùng chung cả hai portal.** Map `ICONS` nằm phía client vì component lucide không vượt được ranh giới RSC — layout truyền xuống một chuỗi khoá. Variant `rail` \| `bottom` |
| `SearchInput` | Form GET một ô — điều hướng, không cần client component |
| `SectionCard` | Panel có viền: header + body (tràn viền để bảng vừa) + footer |
| `StatCard` | Ô số liệu; `href` biến cả ô thành `Link` |
| `StatusDot` | Chấm màu + nhãn |
| `ThemeToggle` | Hiển thị theme nó **sẽ chuyển sang** |

---

## 16. Test

Hai project Vitest tách theo phần mở rộng file.

| Project | Môi trường | File |
|---|---|---|
| Unit | node | `lib/{loyalty,phone,rate-limit,schemas,utils}.test.ts`, `lib/theme/config.test.ts`, `lib/pancake/client.test.ts`, `(account)/tier-accent.test.ts`, `(customer)/auth/actions.test.ts`, `api/webhooks/pancake/route.test.ts` |
| Component | jsdom (`renderWithProviders`, `src/test/render.tsx`) | `components/{portal-nav,theme-toggle}.test.tsx`, `admin/customers/[id]/adjust-form.test.tsx` |

Chạy: `npm test` · `npm run test:watch` · `npm run test:coverage`.

**Ba test `// BUG:` trong `schemas.test.ts` đã bị gỡ** — các bug chúng pin (dấu phẩy thừa,
ô số tiền để trống, ô giá cũ để trống) đã sửa, và test giờ khẳng định hành vi **đúng**.

**Test SQL**: `supabase/tests/*.sql` (pgTAP), chạy bằng `npm run test:db`. **Không** nằm
trong `npm test` vì cần Docker + Supabase CLI — xem `supabase/tests/README.md` để cài lần đầu.

**Vùng chưa có test:** các server action của admin (`saveTier`/`saveReward`/`saveProductPoint`),
`apply_due_tier_schedules`, và `redeem_reward`.

---

## 17. Sổ nợ kỹ thuật

Đây là mục quan trọng nhất khi review. Sắp theo mức độ đáng chú ý.

> Đợt sửa theo `docs/REVIEW.md` đã đóng nhóm 🔴 + 🟠 (mục 1–10 của review đó). Bảng dưới
> chỉ còn những gì **vẫn đang nợ**. Xem `docs/REVIEW.md` để biết chi tiết từng mục và
> những gì đã đóng.

| # | Vấn đề | Vị trí | Ảnh hưởng |
|---|---|---|---|
| 1 | **Rate limit fail-open**: lỗi DB → trả `false` (cho qua) | `rate-limit.ts` | Có chủ ý (mất throttle còn hơn sập luồng claim), nhưng phải biết khi điều tra sự cố |
| 2 | **Đăng ký chỉ transactional một phần.** Rollback (`deleteUser`) phủ `linkAuthUserToPhone` và `linkPancakeCustomer`, chỉ khi `created === true` | `auth/actions.ts` | `update_customer_profile` và sync POS vẫn best-effort + ghi log. `recordAttempt(success)` được ghi kể cả khi claim bị bỏ qua |
| 3 | **`recordAttempt` vẫn thiếu ở vài nhánh** — `linkAuthUserToPhone` hỏng (`phoneTaken`) và `signInFailed` | `auth/actions.ts` | Các nhánh đó không bị throttle. Nhẹ, vì tới được đó vẫn phải qua cổng số điện thoại |
| 4 | **`ACCOUNT_PREFIXES` thiếu 3 route** (`/tiers`, `/help`, `/profile`) dù comment nói đã đồng bộ | `supabase/middleware.ts:9` | Ba route đó chỉ được `getAccount()` chặn ở tầng RSC — vẫn an toàn nhưng điểm thực thi không đồng nhất, và comment đang nói sai |
| 5 | **Comment lỗi thời** | `0011_claim_spend.sql:115-116` nói có cột `order_total` trên `transactions` (thực tế chỉ nằm trong `meta`) · `ui/sonner.tsx` nói "design system is light-only" (ngược — dark mới là baseline) · `i18n/config.ts:3` trỏ `setLocale` không tồn tại | Gây hiểu sai khi đọc code |
| 6 | **Webhook không có cửa sổ chống replay / delivery-id** | `api/webhooks/pancake/route.ts` | Idempotency dựa hoàn toàn vào `isOrderClaimed` (có race) + unique index → `P0002`. Hoạt động đúng, nhưng không có tầng phòng thủ nào khác |
| 7 | **5 server action admin báo "đã lưu" cả khi ghi 0 dòng** — RLS từ chối bằng cách không khớp dòng nào, không phải bằng lỗi | `admin/{tiers,rewards,products}/actions.ts` | Dùng `{ count: "exact" }` như `admin/support/actions.ts:26-31` |
| 8 | **Điểm tràn `integer` trong `claim_points`** — `22003` thô không ai map, thành 500 → webhook retry vô hạn | `0011:106-110` · `route.ts` | Kẹp trần điểm mỗi đơn, hoặc bắt `22003` thành mã lỗi riêng |
| 9 | **`apply_due_tier_schedules()` không khoá `membership_tiers`** — chỉ khoá schedule | `0010` | Hai lần chạy đồng thời (hoặc `saveTier` chen vào) đều kiểm hàng xóm trên giá trị trước commit rồi cùng ghi → thang hạng mất tính tăng dần |
| 10 | **Cron nhiều khả năng chưa từng chạy trên production** — Vercel Cron gửi `Authorization: Bearer`, không set được `x-webhook-secret`; repo không có `vercel.json` | `api/cron/tier-schedules/route.ts` | Đường sống duy nhất là lời gọi `await applyDueTierSchedules()` lúc render `/admin/tiers` |
| 11 | **`extractOrderId` ưu tiên `payload.id` ở tầng ngoài cùng** | `route.ts` | Nếu envelope Pancake mang event-id ở đó thì fetch nhầm đơn. Chưa từng test với payload thật |
| 12 | **Sổ giao dịch không có ràng buộc** buộc dòng EARN phải có `order_code`, cũng không ép dấu của `amount` | `0001:70-81` | Chống trùng chỉ là quy ước; mọi truy vấn tổng hợp đều tin dấu |
| 13 | **Đổi tên `threshold` → `spend_threshold` để lại tên constraint cũ** | `0010_spend_tiers.sql:34-43`, `:46-47` | `alter table … drop constraint` về sau phải dùng tên cũ (`membership_tiers_threshold_key/_check`) |
| 14 | **Enum `source` lệch nhau giữa ba nơi**: `transactions.source` cho `'redeem'`, nhưng `customer_tier_history.source` không, và `claim_points` từ chối thẳng | `0006:15` · `0010:143` · `0011:60` | Có chủ ý, nhưng dễ vấp khi thêm đường ghi mới |
| 15 | **`db-types.ts` là bản mirror ghi tay** — không có type generate từ schema | `src/lib/db-types.ts:3` | Đổi schema phải sửa tay; không có gì bắt được lệch |
| 16 | **Mọi hàm đọc phía khách dùng service-role** → các RLS policy đọc-theo-khách là code chết | `loyalty.ts` | Tuyến phòng thủ thứ hai không tồn tại như tài liệu ngụ ý |
| 17 | **`updateCustomer` GET trước mỗi PUT** | `pancake/client.ts` | Mỗi lần đăng ký tốn thêm tới 2 lượt gọi Pancake. Bản ghi POS đã đủ tên + số thật thì short-circuit thành `"skipped"`, không gọi PUT |

### Ghi chú thêm (không phải nợ, nhưng dễ hiểu lầm)

- `admin/page.tsx:107-115` chạy một query đếm cho mỗi hạng — **N+1 có chủ ý**, N ≤ 5.
- `getAdminTransactions` chạy predicate lọc hai lần (dòng phân trang + tổng toàn tập) —
  có chủ ý, ghi ở `loyalty.ts:363`.
- `phone_numbers` khi PUT lên Pancake là **thay cả mảng**, nên số thật được **nối thêm**
  vào các entry masked cũ chứ không thay thế chúng (`pancake/client.ts:206-209`).
- `orderPhoneCandidates` cố tình không dừng ở giá trị đầu — bug cũ chính là chỗ đó.
- Đăng ký ghi `p_source: "claim"` dù đây là luồng đăng ký; webhook ghi `"webhook"`.
- Email thật được ghi ở **hai** chỗ lúc đăng ký: `linkAuthUserToPhone` (vô điều kiện) và
  `p_email` của `claim_points` (chỉ chạy khi đơn settled, và chỉ điền vào chỗ NULL). Chỗ
  đầu mới là chỗ bắt buộc — xem Phase C.

---

## Phụ lục — chỉ mục nhanh thư viện

| File | Nội dung |
|---|---|
| `src/lib/loyalty.ts` | Toàn bộ hàm đọc phía server (service-role). `getActiveSettings` `:62` · `getSkuPoints` `:84` · `getTiers` `:100` · lookup khách `:109-146` · `linkAuthUserToPhone` `:151` · `linkPancakeCustomer` `:185` · reward `:202-246` · `getTransactions` `:263` · `getAdminTransactions` `:320` · `isOrderClaimed` `:409` · tier `:438-558` |
| `src/lib/db-types.ts` | Mirror ghi tay của schema — mọi row type + kiểu trả về RPC |
| `src/lib/schemas.ts` | 12 factory `makeXSchema(v)` + `SUPPORT_TOPICS` |
| `src/lib/points.ts` | `pointsForItem` `:21` · `calcBasePoints` `:32` · `applyRounding` `:43` · `calcOrderPoints` `:54` |
| `src/lib/phone.ts` | `normalizePhone` · `isValidVnPhone` · `isMasked` · `matchesMask` · `matchesOrderPhones` |
| `src/lib/rate-limit.ts` | `getClientIp` · `isRateLimited` · `recordAttempt` |
| `src/lib/webhook-auth.ts` | `verifyWebhookSecret` `:12` |
| `src/lib/support.ts` | `getSupportCounts()` `:20` |
| `src/lib/rewards.ts` | `LOW_STOCK = 5` |
| `src/lib/tier-perks.ts` | `PERK_ICON_KEYS` `:7` · `MAX_PERKS = 6` `:19` |
| `src/lib/utils.ts` | `cn` (twMerge mở rộng) · `formatVnd` |
| `src/lib/pancake/client.ts` | `getOrder` `:37` · `listVariations` `:86` · `getCustomer` `:157` · `updateCustomer` `:210` · `canonicalOrderCode` `:255` · `toRpcItems` `:269` · `orderSpendTotal` `:284` · `orderPhoneCandidates` `:296` |
| `src/lib/pancake/types.ts` | Zod schema **không có `.passthrough()`** — PII bất ngờ không lọt được vào phản hồi Server Action |
| `src/lib/pancake/order-status.ts` | `DEFAULT_CLAIMABLE_STATUSES = [3, 16]` `:21` |
