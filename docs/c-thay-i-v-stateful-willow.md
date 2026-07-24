# Phân hạng theo số tiền chi tiêu (spend-based tiers)

## Context

Hiện tại hạng thành viên được suy ra từ `customers.lifetime_points`: `membership_tiers.threshold`
so với điểm tích lũy, và cả `claim_points` (`0003`/`0004`) lẫn `adjust_points` (`0008`) đều tính lại
`tier_id` theo công thức đó. Điểm vẫn phải giữ vì đó là thứ khách dùng để đổi quà, nhưng hạng thì
phải phản ánh **doanh thu thực** của khách, không phải số điểm — điểm còn phụ thuộc bảng
`product_points` nên hai khách chi tiêu như nhau có thể ra hạng khác nhau.

Thay đổi cần:

1. Hạng tính theo **tổng tiền chi tiêu tích lũy**, không theo điểm. Bộ 5 hạng cố định: **Bạc, Vàng,
   Bạch kim, Kim cương, Ruby** (Bạc là hạng thấp nhất, mốc 0đ — ai đăng ký cũng có hạng).
2. Release đầu: mốc là số tiền cố định do admin đặt.
3. Về sau khi user đông: admin **nâng mốc**, đặt trước **ngày áp dụng**, và đặt mốc mới theo
   **số tiền** hoặc theo **phần trăm số lượng user** (vd "Ruby = top 5% chi tiêu"). Mốc theo % được
   **chốt thành số tiền cụ thể tại thời điểm áp dụng**, sau đó là con số cố định.
4. Khách đã đạt hạng thì **giữ vĩnh viễn hạng cao nhất từng đạt**, mốc mới không làm tụt hạng.

Quyết định đã chốt với người dùng:

- Tiền tính hạng = `total_price_after_sub_discount`, fallback `total_price`, chỉ cộng khi đơn đạt
  `loyalty_settings.claimable_statuses` (đúng thời điểm đơn được cộng điểm).
- 5 hạng, Bạc = mốc 0đ. Không còn hạng "Thành viên".
- Mốc theo % được resolve thành số VND lúc apply.
- `customers.tier_id` trở thành **hạng cao nhất từng đạt** (sticky, chỉ lên không xuống).
- Admin cấp hạng tay: **gán thẳng `tier_id`**, không bơm tiền ảo vào `lifetime_spend`; vẫn cấp
  điểm được trong cùng form.
- Khách hiện có: `lifetime_spend` bắt đầu từ 0, **không backfill**. Hạng đang có được giữ nhờ
  sticky `tier_id`.

---

## Thiết kế

### 1. Schema — `supabase/migrations/0010_spend_tiers.sql`

```sql
-- customers: tổng tiền chi tiêu tích lũy (đồng, không âm, không bao giờ giảm)
alter table public.customers
  add column if not exists lifetime_spend numeric(14,0) not null default 0
    check (lifetime_spend >= 0);

-- membership_tiers: mốc đo bằng TIỀN, không phải điểm
alter table public.membership_tiers rename column threshold to spend_threshold;
alter table public.membership_tiers alter column spend_threshold type numeric(14,0);
-- unique(threshold) cũ đi theo tên cột; giữ nguyên ràng buộc unique trên spend_threshold
```

Bảng lịch trình nâng mốc:

```sql
create table public.tier_threshold_schedules (
  id                uuid primary key default gen_random_uuid(),
  tier_id           uuid not null references public.membership_tiers(id) on delete cascade,
  mode              text not null check (mode in ('amount','percentile')),
  target_amount     numeric(14,0),          -- mode='amount'
  target_percentile numeric(5,2),           -- mode='percentile': top N% theo lifetime_spend
  resolved_amount   numeric(14,0),          -- ghi cứng lúc apply
  effective_at      timestamptz not null,
  applied_at        timestamptz,
  note              text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  check ((mode = 'amount'     and target_amount     is not null)
      or (mode = 'percentile' and target_percentile is not null
          and target_percentile > 0 and target_percentile < 100))
);

-- Mỗi hạng chỉ có tối đa MỘT lịch trình đang chờ
create unique index tier_schedule_one_pending
  on public.tier_threshold_schedules (tier_id) where applied_at is null;
```

Lịch sử lên hạng (để giải thích grandfathering cho khách và cho CSKH):

```sql
create table public.customer_tier_history (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers(id) on delete cascade,
  tier_id          uuid references public.membership_tiers(id) on delete set null,
  tier_name        text not null,             -- snapshot: tên có thể bị đổi sau
  threshold_amount numeric(14,0) not null,    -- mốc TẠI THỜI ĐIỂM đạt
  spend_at_award   numeric(14,0) not null,
  source           text not null check (source in ('claim','webhook','admin')),
  awarded_at       timestamptz not null default now()
);
create index customer_tier_history_customer_idx
  on public.customer_tier_history (customer_id, awarded_at desc);
```

RLS (theo pattern `0002`/`0005`): `tier_threshold_schedules` chỉ admin đọc/ghi; `customer_tier_history`
khách đọc row của mình (`auth_user_id`), admin đọc hết; không ai ghi trực tiếp (chỉ RPC service-role).

### 2. Hàm hỗ trợ — cùng migration `0010`

```sql
-- Số tiền tại percentile: top P% khách theo lifetime_spend.
create or replace function public.tier_percentile_amount(p_percentile numeric)
returns numeric ...
  select percentile_disc(1 - p_percentile/100) within group (order by lifetime_spend)
    from public.customers where lifetime_spend > 0;
```

`apply_due_tier_schedules()` — service-role, idempotent:

- Lấy mọi row `applied_at is null and effective_at <= now()`, `for update skip locked`.
- `resolved_amount` = `target_amount`, hoặc `tier_percentile_amount(target_percentile)`.
- Bỏ qua (đánh dấu applied + note) nếu `resolved_amount` nhỏ hơn mốc hiện tại (chỉ nâng, không hạ)
  hoặc va vào mốc của hạng khác — mốc phải giữ đúng thứ tự tăng dần theo `sort_order`.
- `update membership_tiers set spend_threshold = resolved_amount`, `applied_at = now()`.
- **Không** đụng tới `customers.tier_id` — đó chính là cơ chế grandfather.
- Trả về json danh sách hạng đã đổi mốc, để route cron log lại.

### 3. `claim_points` v3 — `supabase/migrations/0011_claim_spend.sql`

Bản sao `0004` với các thay đổi (nhớ: mọi thay đổi ở đây phải soi gương với `src/lib/points.ts`):

- Thêm tham số `p_order_total numeric default 0` (drop overload 7-arg cũ trước, re-grant cho
  service_role — đúng cách `0004` đã làm).
- Hệ số nhân điểm vẫn lấy từ hạng hiện tại (`membership_tiers.multiplier`) — **không đổi**.
- `lifetime_spend = lifetime_spend + greatest(p_order_total, 0)`.
- Suy hạng theo TIỀN và **sticky**:

```sql
select t.id, t.spend_threshold into v_new_tier, v_new_threshold
  from public.membership_tiers t
 where t.spend_threshold <= v_new_spend
 order by t.spend_threshold desc limit 1;

-- chỉ lên hạng, không bao giờ tụt: so sánh mốc của hạng mới với mốc hạng đang giữ
if v_new_tier is not null
   and (v_old_threshold is null or v_new_threshold > v_old_threshold) then
  -- update tier_id + insert customer_tier_history (source = p_source)
end if;
```

- Return thêm `lifetime_spend`.
- Ghi `order_total` vào `transactions.meta` để về sau có thể dựng lại/đối soát.

### 4. `adjust_points` v2 — `supabase/migrations/0012_adjust_tier_direct.sql`

Giữ nguyên chữ ký 6 tham số (nên `create or replace` chạy được), đổi ngữ nghĩa
`p_grant_tier_id`: **gán thẳng `customers.tier_id`**, không đụng `lifetime_points` /
`lifetime_spend`. Vẫn chỉ cấp lên (từ chối hạng có `spend_threshold` thấp hơn hạng đang giữ, mã
lỗi `P0005` như hiện tại). Vẫn cấp điểm được cùng lúc qua `p_current_delta` / `p_lifetime_delta`.
Ghi `customer_tier_history` với `source='admin'`. Xoá đoạn comment ở đầu `0008` giải thích
"tier grant nâng lifetime_points" — nó không còn đúng.

### 5. Route cron áp dụng mốc

`src/app/api/cron/tier-schedules/route.ts` — bảo vệ bằng secret giống `src/lib/webhook-auth.ts`,
gọi `apply_due_tier_schedules()` bằng `createAdminClient()`. Ngoài ra gọi luôn (fire-and-forget)
khi admin mở `/admin/tiers`, để mốc tới hạn được áp dụng kể cả khi chưa cấu hình cron.

### 6. TypeScript

| File | Thay đổi |
|---|---|
| `src/lib/db-types.ts` | `MembershipTierRow.threshold` → `spend_threshold`; `CustomerRow += lifetime_spend`; `ClaimResult += lifetime_spend`; thêm `TierScheduleRow`, `CustomerTierHistoryRow` |
| `src/lib/loyalty.ts` | `resolveTiers`/`tierProgress` nhận `lifetimeSpend` và đọc `spend_threshold`; thêm `resolveDisplayTier(tiers, customer)` = hạng cao hơn giữa `customer.tier_id` (sticky) và hạng suy ra từ chi tiêu — UI không bao giờ hiển thị thấp hơn hạng đã lưu; `getTiers()` sort theo `spend_threshold` |
| `src/lib/pancake/client.ts` | thêm `orderSpendTotal(order)` = `total_price_after_sub_discount ?? total_price ?? 0` (kề `toRpcItems`) |
| `src/app/api/webhooks/pancake/route.ts` | truyền `p_order_total: orderSpendTotal(order)` |
| `src/app/(customer)/auth/actions.ts` | đơn chứng minh lúc đăng ký cũng truyền `p_order_total` |
| `src/lib/schemas.ts` | `makeTierSchema`: `threshold` → `spend_threshold` (số nguyên ≥ 0); thêm `makeTierScheduleSchema` (mode, target_amount \| target_percentile, effective_at, note) |
| `src/lib/utils.ts` | dùng lại `formatVnd()` sẵn có cho mọi chỗ hiển thị mốc |

### 7. UI admin

- `src/app/admin/tiers/page.tsx` + `tier-form.tsx`: cột mốc hiển thị `formatVnd(spend_threshold)`,
  label đổi sang "Mốc chi tiêu". Thêm cột **"Mốc sắp áp dụng"** đọc từ
  `tier_threshold_schedules` (row pending), kèm ngày hiệu lực.
- Dialog mới `schedule-form.tsx`: chọn hạng, chế độ (số tiền / top N%), ngày giờ áp dụng, ghi chú.
  Ở chế độ % có **preview** gọi server action → `tier_percentile_amount()` để admin thấy trước
  con số VND ứng với phân phối hiện tại.
- `src/app/admin/tiers/actions.ts`: thêm `saveTierSchedule`, `cancelTierSchedule`,
  `previewPercentileAmount`; `revalidatePath` cho `/admin/tiers`, `/tiers`, `/dashboard` như hiện tại.
- `src/app/admin/customers/page.tsx` + `[id]/page.tsx`: thêm cột/ô "Chi tiêu tích lũy"
  (`formatVnd`); thanh tiến độ hạng đổi sang thang tiền.
- `src/app/admin/customers/[id]/adjust-form.tsx`: bỏ lọc theo `threshold <= nextLifetime`; giờ
  liệt kê mọi hạng cao hơn hạng đang giữ, label không còn kèm số điểm.

### 8. UI khách

- `dashboard/page.tsx`, `tiers/page.tsx`, `(account)/layout.tsx`: `tierProgress(tiers,
  customer.lifetime_spend)`, hiển thị mốc bằng `formatVnd`, thẻ thống kê "Chi tiêu tích lũy" bên
  cạnh điểm. Điểm vẫn là thứ đổi quà — không đổi gì ở `/rewards`.
- `tier-accent.ts` không đổi: đã keyed theo **rank** trong danh sách sort theo mốc, nên đổi từ điểm
  sang tiền là trong suốt. Với 5 hạng, 5 màu `--tier-1..5` khớp đúng 1-1.
- Trên `/tiers`, khi hạng sticky cao hơn hạng chi tiêu hiện tại đáng ra được hưởng, hiện dòng
  "Hạng được giữ theo mốc cũ" dựa trên `customer_tier_history`.

### 9. i18n & seed

- Thêm key vào `src/lib/i18n/messages/en.ts` **trước** (nguồn sự thật), rồi `vi.ts`:
  `admin.tiers.spendThreshold`, `.schedule*`, `.percentileMode`, `.effectiveAt`, `.pendingThreshold`,
  `customer.tiers.spendToNext`, `.grandfathered`, `customer.dashboard.lifetimeSpend`.
- `supabase/seed.sql`: thay 4 hạng cũ bằng 5 hạng (mốc gợi ý, admin sửa được):

| Hạng | Mốc chi tiêu | Hệ số điểm | sort_order |
|---|---|---|---|
| Bạc | 0đ | 1.0 | 1 |
| Vàng | 3.000.000đ | 1.2 | 2 |
| Bạch kim | 8.000.000đ | 1.5 | 3 |
| Kim cương | 20.000.000đ | 1.8 | 4 |
| Ruby | 50.000.000đ | 2.0 | 5 |

Seed hiện dùng `on conflict (name) do nothing` — cần `delete from membership_tiers where name = 'Thành viên'`
(hoặc đổi tên thành 'Bạc') trong migration để không còn hạng mồ côi. Khách đang trỏ vào hạng bị xoá
sẽ về `tier_id = null` (`on delete set null`) rồi được suy lại từ chi tiêu — với hạng Bạc mốc 0đ thì
ai cũng có hạng, nên không mất gì.

---

## Files chính

- Mới: `supabase/migrations/0010_spend_tiers.sql`, `0011_claim_spend.sql`, `0012_adjust_tier_direct.sql`
- Mới: `src/app/api/cron/tier-schedules/route.ts`, `src/app/admin/tiers/schedule-form.tsx`
- Sửa: `src/lib/{db-types,loyalty,schemas,points}.ts`, `src/lib/pancake/client.ts`,
  `src/app/api/webhooks/pancake/route.ts`, `src/app/(customer)/auth/actions.ts`,
  `src/app/admin/tiers/*`, `src/app/admin/customers/**`, `src/app/(customer)/(account)/{dashboard,tiers,layout}`,
  `src/lib/i18n/messages/{en,vi}.ts`, `supabase/seed.sql`, `AGENTS.md`

## Kiểm thử

1. `npx supabase db reset` — migrations + seed chạy sạch, 5 hạng đúng mốc.
2. Unit (`src/lib/*.test.ts`): thêm test cho `resolveTiers`/`tierProgress` theo tiền và cho
   `resolveDisplayTier` (hạng sticky cao hơn hạng chi tiêu → trả hạng sticky).
3. SQL trực tiếp (`mcp__supabase__execute_sql` trên nhánh dev):
   - `claim_points` với `p_order_total` → `lifetime_spend` tăng, `tier_upgraded=true` khi vượt mốc,
     có row `customer_tier_history`.
   - Nâng `spend_threshold` của Vàng lên trên chi tiêu của khách đó → gọi lại `claim_points` với đơn
     nhỏ, khách **vẫn giữ** Vàng (đây là bài test grandfather).
   - `adjust_points` với `p_grant_tier_id` → `tier_id` đổi, `lifetime_spend` **không đổi**.
4. Lịch trình: tạo schedule `percentile` `effective_at = now()`, gọi `apply_due_tier_schedules()`,
   kiểm tra `resolved_amount` khớp `tier_percentile_amount()` và `spend_threshold` đã đổi.
5. Webhook: POST đơn thật vào `/api/webhooks/pancake` (bruno có sẵn `Get Order.bru` để lấy id),
   xác nhận `lifetime_spend` cộng đúng `total_price_after_sub_discount`.
6. `npm run build` + xem `/admin/tiers`, `/dashboard`, `/tiers` ở cả hai ngôn ngữ.
