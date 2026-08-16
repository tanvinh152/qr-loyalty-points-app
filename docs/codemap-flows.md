# Codemap — 8 luồng chính (bản đã đối chiếu code)

> Gộp từ codemap `QR Loyalty Points System — Customer Registration, Webhook Earning,
Redemption & Admin Flows`. **Mọi số dòng trong file này đã được đọc lại từ code
> ngày 2026-08-15** — codemap gốc lệch gần như toàn bộ anchor (xem §9).
>
> File này là **bản đồ anchor**: sơ đồ gọi + vị trí chính xác. Phần giải thích
> _vì sao_ nằm ở `OVERVIEW.md`; luật bất biến nằm ở `AGENTS.md`. Đừng viết lại
> nghiệp vụ ở đây.

## Mục lục

| #   | Luồng                             | Cửa vào                                                               |
| --- | --------------------------------- | --------------------------------------------------------------------- |
| 1   | Đăng ký + claim điểm lần đầu      | `signUp` — `src/app/(customer)/auth/actions.ts:115`                   |
| 2   | Webhook cộng điểm tự động         | `POST` — `src/app/api/webhooks/pancake/route.ts:63`                   |
| 3   | Đăng nhập (phone → email)         | `signIn` — `src/app/(customer)/auth/actions.ts:63`                    |
| 4   | Đổi quà (lock tồn kho)            | `redeemReward` — `src/app/(customer)/(account)/rewards/actions.ts:52` |
| 5   | Admin điều chỉnh điểm/hạng        | `adjustPoints` — `src/app/admin/customers/[id]/actions.ts:17`         |
| 6   | Middleware auth & 5 luật redirect | `proxy` — `src/proxy.ts:5`                                            |
| 7   | Tính điểm — chỉ còn MỘT bản (SQL) | `claim_points` — `supabase/migrations/0011_claim_spend.sql:99`        |
| 8   | Hạng theo chi tiêu, sticky        | `0011` + `0010` + `src/lib/loyalty.ts:674`                            |

---

## 1. Đăng ký & claim điểm lần đầu

Toàn bộ trong `src/app/(customer)/auth/actions.ts`. Bốn phase: mọi thứ **có thể
từ chối** xảy ra TRƯỚC khi auth user tồn tại, nên một lỗi nghiệp vụ không để lại
gì phải rollback.

```
signUp()                                                        :115
├── Phase A — validate, chưa tạo gì
│   ├── zod makeCustomerSignupSchema                            :122
│   ├── getClientIp() / isRateLimited(ip, typedCode)            :140-141   ← cả 2 budget: IP + order code
│   ├── getOrder(typedCode)                                     :150       → pancake/client.ts:37
│   │   └── PancakeRequestError kind !== "not_found" → 503, KHÔNG trừ lượt   :155
│   ├── matchesOrderPhones(phone, orderPhoneCandidates(order))  :166       ← CỔNG SỞ HỮU
│   │                                                                        phone.ts / client.ts:308
│   ├── order.customer.customer_id thiếu → orderNotLinkable     :173-177
│   └── getCustomerByPancakeId() — POS customer đã có chủ?      :188       → loyalty.ts:251
│       └── lookup lỗi ⇒ dừng (không fail-open)                 :189-196
├── Phase B — tạo / nhận lại auth user
│   ├── rpc find_orphan_auth_user(p_phone)                      :211       → 0014:36 (thay 0009:29, keyed by PHONE)
│   ├── orphan ⇒ admin.updateUserById (nhận xác)                :222
│   └── không ⇒ admin.createUser(email_confirm: true)           :250       ← không dùng auth.signUp: không gửi mail
├── Phase C — nối vào public.customers
│   └── linkAuthUserToPhone(authUserId, phone, email)           :275       → loyalty.ts:288
│       └── upsert on conflict "phone"                                        loyalty.ts:302-314
│           (thừa hưởng điểm webhook đã cộng trước khi đăng ký)
│       └── thất bại ⇒ xoá auth user vừa tạo                    :278
└── Phase D — best-effort, KHÔNG được biến signup thành lỗi
    ├── settings.claimable_statuses.includes(order.status)      :289       ← claim_points KHÔNG tự check status
    ├── rpc claim_points(..., p_order_total)                    :290       → 0011:20
    ├── linkPancakeCustomer()                                   :313       → loyalty.ts:347  ⚠ NGOẠI LỆ:
    │   └── thất bại ⇒ xoá auth user + dừng                     :314-323     lỗi ở đây PHẢI kết thúc signup
    ├── rpc grant_welcome_gift()                                :328       → 0018:24
    ├── rpc update_customer_profile()                           :335       → 0007:95
    ├── updateCustomer() — đẩy tên+phone thật lên POS           :348       → client.ts:210
    ├── recordAttempt(ip, orderCode, true)                       :357
    ├── setThemeCookie(themeForDob(dob))                         :361
    └── signInWithPassword → redirect("/dashboard")              :365-371  ← createUser không phát session
```

**Bất biến**: `linkPancakeCustomer` là bước best-effort duy nhất _không_ tuỳ chọn —
không có link thì account vô hình với webhook mãi mãi.

---

## 2. Webhook cộng điểm tự động

`src/app/api/webhooks/pancake/route.ts`. Đường DUY NHẤT cộng điểm sau đăng ký.
Mọi kết cục **nghiệp vụ** trả 200 (Pancake retry mọi non-2xx); chỉ lỗi hạ tầng
mới trả 5xx.

```
POST /api/webhooks/pancake                                      :63
├── verifyWebhookSecret(req)                                    :64        → lib/webhook-auth.ts (so sánh timing-safe)
├── req.json() lỗi → 422                                        :69-73
├── extractOrderId(body)                                        :75        (schema :36-56) — body chỉ là CON TRỎ
├── getOrder(orderId)                                           :85        ← dữ liệu THẨM QUYỀN lấy từ API
│   ├── not_found            → skip 200                         :87
│   ├── unauthorized/malformed → skip 200 + log CONFIG ERROR    :94-104
│   └── còn lại             → 503 (retry được)                  :107
├── getActiveSettings()                                         :110       → loyalty.ts:64
├── !claimable_statuses.includes(order.status) → skip           :118       ← ĐÚNG cái kích hoạt cộng điểm
├── canonicalOrderCode(order)                                   :122       → client.ts:255
├── isOrderClaimed / getCustomerByPancakeId (THROW, không "no") :131-133   → loyalty.ts:618 / :251
│   └── lỗi DB → 503, không phải "unknown_customer"             :135-138
├── !customer → skip("unknown_customer")                        :141       ← chưa đăng ký thì không có gì để cộng
├── rpc claim_points(p_source: "webhook", p_order_total)        :146       → 0011:20
│   └── P0002 → skip("already_claimed")                         :162
└── isTikTokSource → enqueueTikTokReconciliation()              :172 → :194  → 0016
```

### `claim_points` — `supabase/migrations/0011_claim_spend.sql`

```
claim_points(p_order_code, p_phone, p_full_name, p_email,
             p_pancake_customer_id, p_items, p_source, p_order_total)   :20
├── validate order_code / phone / source                                :52-62
├── v_spend := greatest(p_order_total, 0)   ← refund không kéo tụt      :65
├── loyalty_settings đang active, thiếu → P0004                         :67-70
├── UPSERT customers on (phone), fill-if-null                           :73-80
├── multiplier + ngưỡng của hạng ĐANG giữ (fallback theo spend)          :85-96
├── điểm gốc theo SKU: jsonb_to_recordset ⋈ product_points              :99-104
│   └── SKU lạ/inactive → settings.unmapped_sku_points
├── làm tròn: floor | ceil | round                                      :106-110
├── INSERT transactions ('EARN')  ← unique index order_code = idempotency :118
│   └── unique_violation → P0002 'order already claimed'                :122
├── v_new_spend = lifetime_spend + v_spend                              :126
├── hạng cao nhất mà spend mới với tới                                   :129-133
├── chỉ nhận khi ngưỡng THẬT SỰ cao hơn (monotonic)                     :136
├── UPDATE customers: current/lifetime_points, lifetime_spend, tier_id  :140-147
└── INSERT customer_tier_history khi lên hạng                            :152-157
grant execute → service_role ONLY                                        :170-173
```

---

## 3. Đăng nhập — phone giải ra email

Supabase Auth khoá theo email; số điện thoại chỉ là **khoá tra cứu**, không bao
giờ là credential Supabase thấy (`0014_real_email_identity.sql`).

```
signIn()                                                        :63
├── zod makeCustomerLoginSchema                                 :70
├── getClientIp / isRateLimited(ip)                             :80-81     ← chung budget với signUp
├── getCustomerByPhone(phone)                                   :87        → loyalty.ts:229
│   └── không có email ⇒ CÙNG một thông điệp như sai mật khẩu   :88-91     (không dò được ai là hội viên)
├── supabase.auth.signInWithPassword({ email, password })       :94
├── lỗi ⇒ recordAttempt(ip, null, false) + invalidCredentials   :99-102
├── getTheme() === null ⇒ setThemeCookie(themeForDob(dob))      :107-110   ← chỉ seed khi chưa từng tự chọn
└── redirect("/dashboard")                                      :112
```

---

## 4. Đổi quà — lock rồi mới kiểm

Server Action: `src/app/(customer)/(account)/rewards/actions.ts`.
**RPC đang chạy là bản trong `0022_spin_wheel.sql:150`** (kế thừa `0017` → `0006`).

```
redeemReward(rewardId)                                          :52
├── auth.getUser() — session là thứ chứng minh ví của ai        :54-57
├── getCustomerByAuthUserId(user.id)                            :59        → loyalty.ts:266
├── admin.rpc("redeem_reward", { p_customer_id, p_reward_id })  :63        ← client chỉ gửi reward id
├── codeFor(error.code): P0001/P0002/P0003/P0006                :44-50
└── revalidatePath /rewards /dashboard /history                 :76-78

redeem_reward(uuid, uuid)                        0022_spin_wheel.sql:150
├── SELECT rewards … is_active AND kind = 'redeem' FOR UPDATE        :167-170
│   └── kind: slice vòng xoay không phải hàng hoá → P0001            (0022)
├── quantity <= 0                                → P0002             :176
├── SELECT customers … FOR UPDATE                                     :180
├── cổng hạng: min_tier_id so bằng spend_threshold → P0006            :193-203  (0017)
│   └── tier_id NULL floor về -1
├── current_points < points_cost                 → P0003              :205
├── INSERT transactions ('REDEEM', -points_cost, source 'redeem')     :209
├── UPDATE rewards SET quantity = quantity - 1                        :216
└── UPDATE customers SET current_points = current_points - cost       :220
    └── lifetime_points KHÔNG đổi — tiêu điểm không được tụt hạng
```

---

## 5. Admin điều chỉnh điểm / cấp hạng

```
adjustPoints(input)              src/app/admin/customers/[id]/actions.ts:17
├── makeAdjustSchema                                            :21
├── TỰ kiểm app_metadata.role === "admin"                       :33        ← Server Action là POST public,
│                                                                            guard /admin ở proxy KHÔNG đủ
├── admin.rpc("adjust_points", …, p_actor: { id, email })       :40
├── P0003 → insufficient · P0005 → noChange                     :50-51
└── revalidate 3 trang admin + /dashboard /tiers /history        :56-62

adjust_points(...)                    0012_adjust_tier_direct.sql:19
├── p_reason rỗng                                → P0001              :43
├── SELECT customers … FOR UPDATE (giữ suốt lệnh)                     :50-53
├── tính target current/lifetime                                       :59-62
├── cấp hạng: so spend_threshold, KHÔNG so sort_order                 :64-83
│   └── chỉ cho lên hạng (v_grant_thr > v_old_thr)                    :79
├── không đổi gì gì cả                           → P0005              :87-91
├── target âm                                    → P0003              :95
├── INSERT transactions ('ADJUST', amount = current_delta, meta:
│   reason/actor/deltas/granted_tier_id)                              :102-110
├── UPDATE customers: current, lifetime, tier_id                       :114-120
│   └── lifetime_spend CỐ TÌNH không chạm — cấp hạng là quyết định,
│       không phải doanh thu; bơm spend làm lệch mọi percentile
└── INSERT customer_tier_history (source 'admin')                      :125-130
```

---

## 6. Middleware auth & 5 luật redirect

`src/proxy.ts` (Next 16 đổi tên `middleware` → `proxy`) → `src/lib/supabase/middleware.ts`.

```
proxy(request)                                        src/proxy.ts:5
└── matcher: mọi route trừ static/_next/ảnh                        :9-14
    └── updateSession(request)                    supabase/middleware.ts:10
        ├── createServerClient + cầu nối cookie getAll/setAll          :13-32
        ├── auth.getUser()  ← gọi mạng thật, không chỉ giải cookie     :34-36
        ├── phân loại path                                             :38-44
        │   └── ACCOUNT_PREFIXES = /dashboard /rewards /history        :9
        ├── isStaff = app_metadata.role === "admin"                    :47
        │   └── app_metadata chỉ service_role ghi được → không tự phong
        └── 5 luật, đúng thứ tự này
            1. /admin (không phải login) + chưa auth → /admin/login    :57
            2. /admin + session khách                → /dashboard      :59
            3. /admin/login + staff                  → /admin          :61
            4. account area + chưa auth              → /login          :64
            5. /login|/register + có session         → /admin|/dashboard :65
```

⚠️ `ACCOUNT_PREFIXES` phải khớp tay với route group `(account)/`. Hiện thiếu
`/profile`, `/tiers`, `/spin`, `/help` — chúng chỉ được che bởi
`getAccount()` (`(account)/account.ts:20`, redirect `/login` ở `:28`) mà mỗi page
tự gọi. Xem `OVERVIEW.md` §3 "Lỗ hổng phòng thủ tầng edge".

---

## 7. Tính điểm — chỉ còn MỘT bản

Codemap gốc mô tả "dual implementation" (TS preview + SQL authority). **Sai kể từ
khi bản TS bị xoá.** `src/lib/points.ts` giờ chỉ còn type:

```
src/lib/points.ts        :1-22   comment giải thích vì sao bản TS bị xoá
                         :9      Rounding = "floor" | "round" | "ceil"
                         :11     LoyaltyRules  :16 ClaimItem  :22 SkuPointMap
```

Số học **chỉ** ở `0011_claim_spend.sql:99-110`. Không dựng lại bản thứ hai; nếu
admin UI cần preview thì gọi RPC.
(Header comment của `0011:10-12` vẫn nhắc `calcOrderPoints()` — đã lạc hậu, sửa
migration đã deploy thì không, sửa comment thì được.)

---

## 8. Hệ thống hạng — theo CHI TIÊU, sticky

```
Ghi (khi có đơn)            0011_claim_spend.sql
├── multiplier lấy từ hạng TRƯỚC đơn này                             :85
├── lifetime_spend += order_total                                     :126/:143
├── ứng viên = hạng cao nhất có spend_threshold <= spend mới          :129-133
└── chỉ nhận khi ngưỡng cao hơn ngưỡng đang giữ                       :136

Đọc (giao diện)             src/lib/loyalty.ts
├── getTiers() — order by spend_threshold asc                         :220
├── resolveTiers(tiers, lifetimeSpend) → hạng spend tự kiếm           :649
├── resolveDisplayTier(tiers, customer) = max(stored, earned)         :674
│   └── stored có thể VƯỢT ngưỡng hiện tại — đó là grandfathering     :678-682
├── tierProgress(tiers, spend, customer?) — đo TRONG dải, không từ 0  :705
├── getPendingTierSchedules()                                         :735
└── getLatestTierAward()                                              :754
    ⚠ UI luôn dùng resolveDisplayTier/tierProgress, không dùng hạng thô.
    Màu gem chọn theo THỨ HẠNG: (account)/tier-accent.ts

Nâng ngưỡng theo lịch       0010_spend_tiers.sql
├── tier_percentile_amount(p)  — chỉ xếp hạng người có spend > 0      :187-200
└── apply_due_tier_schedules()                                        :218
    ├── applied_at is null AND effective_at <= now() FOR UPDATE
    │   SKIP LOCKED  ← cron đua với admin page không áp 2 lần          :235-239
    ├── percentile → chốt thành số tiền, làm tròn                      :246-250
    ├── chặn trên/dưới theo tier kề (sort_order)                       :254-257
    ├── lịch phá thang ⇒ ĐÁNH DẤU applied + note [skipped: …]          :259-273
    │   (để pending sẽ bắn lại mãi mãi)
    ├── UPDATE membership_tiers.spend_threshold                        :275-277
    └── KHÔNG chạm public.customers — chính chỗ trống đó LÀ
        grandfathering
    Gọi từ: src/app/api/cron/tier-schedules/route.ts:33
            src/app/admin/tiers/actions.ts:233 (fire-and-forget khi render)
```

---

## 9. Sai lệch của codemap gốc so với code

Không chỉ lệch số dòng — có 3 chỗ **sai về bản chất**:

| Codemap nói                                                                      | Thực tế                                                                                                                 |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Trace 7: điểm có 2 bản, TS `calcOrderPoints` ở `points.ts:54` "phải giữ đồng bộ" | Bản TS **đã bị xoá**; `points.ts` chỉ còn type. Nghĩa vụ đồng bộ không còn tồn tại                                      |
| Trace 4: đổi quà = `0006_redeem_rpc.sql`                                         | Bản đang chạy là `0022_spin_wheel.sql:150` — thêm `kind = 'redeem'` và **cổng hạng P0006** (`0017`) mà codemap không có |
| Trace 1: Phase D = claim + link                                                  | Còn `grant_welcome_gift` (`0018`), `update_customer_profile` (`0007`), `updateCustomer` đẩy dữ liệu lên POS             |
| Trace 2: kết thúc ở `claim_points`                                               | Còn hàng đợi đối chiếu TikTok (`0016`) sau khi claim xong                                                               |
| `signUp` ở `:88`, gate phone `:127`, claim `:225`, link `:246`                   | `:115`, `:166`, `:290`, `:313`                                                                                          |
| Webhook `claim_points` ở `:131`                                                  | `:146`                                                                                                                  |
| `loyalty.ts:113/138/164/192/438/463/494`                                         | `:229` / `:251` / `:288` / `:347` / `:649` / `:674` / `:705`                                                            |
| `0006:28/34/44/62/65`, `0012:45/64/97/120`, `0010:240`                           | `0022:167/176/205/216/220`, `0012:50/79/102/114`, `0010:275`                                                            |

## 10. Codemap chưa phủ (migration 0016–0022)

| Migration                                                   | Nghiệp vụ                                                             | Cửa vào                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| `0016_tiktok_reconciliation.sql:53` `reconcile_order_spend` | Đơn TikTok claim xong được kiểm lại sau `TIKTOK_RECONCILE_DELAY_DAYS` | `src/app/api/cron/reconcile-tiktok-orders/route.ts:85` |
| `0017_reward_tier_gate.sql`                                 | `rewards.min_tier_id` — cổng hạng khi đổi quà                         | đã gộp vào §4                                          |
| `0018_welcome_gift.sql:24` `grant_welcome_gift`             | Điểm thưởng một lần khi đăng ký                                       | `auth/actions.ts:328`                                  |
| `0019_checkin.sql:49` `checkin`                             | Điểm danh mỗi ngày (múi giờ `Asia/Ho_Chi_Minh`)                       | `(account)/dashboard/actions.ts:50`                    |
| `0020_blog.sql`                                             | Bài viết                                                              | —                                                      |
| `0021_admin_login_attempts.sql`                             | Rate limit riêng cho đăng nhập admin                                  | `lib/rate-limit.ts:96,109`                             |
| `0022_spin_wheel.sql:244` `spin_wheel`                      | Vòng xoay; slice dùng chung bảng `rewards` (`kind`)                   | `(account)/spin/actions.ts:56`                         |

> `OVERVIEW.md` §12 vẫn ghi "Changelog 13 migration" trong khi repo đã có 22 —
> phần đó cần cập nhật riêng.
