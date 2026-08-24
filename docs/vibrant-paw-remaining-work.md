# Vibrant Paw — phần còn lại cần implement

> Viết ngày 2026-08-23. Nối tiếp đợt đồng bộ UI theo `design/stitch-light/` (phiên bản
> **Vibrant Paw**). Phần nền đã xong và đã deploy được; file này chỉ mô tả **hai trang còn
> lại** cùng những cạm bẫy đã phát hiện, để không phải dò lại.

---

## 1. Đã xong — đừng làm lại

| Hạng mục | Nơi |
|---|---|
| Đảo theme: **sáng là `:root`**, tối là `[data-theme="dark"]` + mirror `prefers-color-scheme: dark` | `src/app/globals.css` |
| Bảng màu sáng = Vibrant Paw; **bảng màu tối giữ nguyên stitch-v2**, không sửa một hex nào | `globals.css` |
| Font → Plus Jakarta Sans (variable 200–800, có subset `vietnamese`) | `src/app/layout.tsx` |
| Thang chữ theo VP + step-down điện thoại cho `display`/`headline-lg`/`headline-md` | `globals.css` |
| Thang bo góc: `3xl` = 32px (widget), `4xl` = 48px (hero); input/nút/badge/select = `rounded-full` | `globals.css` + `src/components/ui/*` |
| 4 utility bóng `shadow-{soft,elevated,nav,glow}` đổi màu theo theme | `globals.css` |
| `@utility bg-canvas` (gradient xanh→hồng; bản tối phẳng) áp ở 4 shell | `globals.css` |
| `pattern-paws` dùng `var(--paw-dot)` thay literal | `globals.css` |
| `t.brand.name` → `"ChiCha Membership"` (cả khách lẫn admin) | `messages/{en,vi}.ts` |
| Nav còn **đúng 4 mục** (dashboard → tiers → rewards → history), rail và bottom bar dùng chung một mảng | `(customer)/(account)/layout.tsx` |
| Header ở **mọi bề rộng**: nút thu gọn (md+) → pill điểm → "Nâng hạng" (md+) → ThemeToggle (md+) → đăng xuất (md+) → avatar `/profile` (md+) / `AccountMenu` (phone) | cùng file |
| "Nâng hạng" + **đăng xuất** đã rời rail lên header. Ràng buộc cũ ("bỏ đi là bẫy người dùng") nay được thoả **hơn** trước: đăng xuất có ở *mọi* bề rộng, thay vì chỉ desktop-rail. Dưới `md` cả hai nằm trong sheet tài khoản sau avatar | cùng file + `src/components/account-menu.tsx` |
| Rail thu gọn được (cookie `sidebar_collapsed`, đọc phía server nên không nháy); khi thu gọn nhãn thành `sr-only` + `title`, **không bao giờ** `hidden` | `src/components/portal-sidebar.tsx`, `src/lib/sidebar/` |
| `PortalFooter` 4 link (Trợ giúp / FAQ / Thể lệ / Cộng đồng) | `src/components/portal-footer.tsx` |
| Route group `(public)` + `/faq` + `/terms`; `/blog` chuyển vào (URL không đổi) | `src/app/(public)/` |
| Link "Điều khoản" / "Chính sách bảo mật" ở form đăng ký trỏ `/terms` và `/terms#privacy` | `register-form.tsx` |
| Khối cài đặt `/profile` bỏ `md:hidden` | `profile/page.tsx` |
| `ACCOUNT_PREFIXES` đủ 7 route (trước thiếu `/tiers` `/help` `/profile` `/spin`) | `src/lib/supabase/middleware.ts` |
| **Migration `0023` đã chạy lên production**: mốc hạng về đúng §8.2 | `supabase/migrations/0023_tier_ladder_spec.sql` |

Trạng thái: `npm run typecheck` / `test` (226) / `build` đều xanh, lint còn đúng 1 cảnh báo có
sẵn từ trước (`react-hooks/incompatible-library` ở `spin-prize-form.tsx`), và `src/` có **0 màu
literal** — giữ nguyên như vậy.

---

## 2. `/dashboard` — dựng lại

File: `src/app/(customer)/(account)/dashboard/page.tsx`
Mockup: `design/stitch-light/html/bangdieukhien-vibrant-paw.html`

Thứ tự khối mới (footer do layout lo, không thêm vào trang):

1. **Lời chào** — giữ `PageHeader size="display"` với `d.greeting` / `d.petLine` / `d.addPetCta`.
   **Bỏ nút CTA ở `children`**: hero bên dưới đã mang CTA "Đổi điểm", hai nút trong 200px đọc
   thành hai đích đến.

2. **Hero widget** — gộp **cả hai** thứ đang có: 2 `StatCard` *và* khối `<section>` hành trình
   hạng, thành một card.
   - Wrapper `rounded-4xl p-6 md:p-8` + `tierAccentClass(tierRank(tiers, current?.id))` từ
     `../tier-accent`.
   - Nên **giữ lớp wash theo hạng** thay vì gradient bão hoà của mockup: wash giữ được màu gem
     của hạng (quy ước trong `AGENTS.md`) và an toàn tương phản ở cả hai theme mà không phải
     làm gì thêm.
   - Trái trên: chip hạng (`Medal` + `current?.name ?? d.noTier`) dạng pill; dưới đó
     `customer.current_points` cỡ `text-display`, kèm `nav.pointsUnit` nhỏ.
   - Phải trên: `d.lifetimeSpend` + `formatVnd(customer.lifetime_spend)` cỡ `headline-md`.
   - Panel lồng bên dưới (`rounded-3xl`, cao hơn một bậc nền): `d.spendAway(formatVnd(toNext))`
     hoặc `d.topTier`, `<Progress value={progress/100} accent />`, và CTA sang `/rewards`.
     **Giữ** `d.percentComplete` và hai đầu mốc `formatVnd(floor)` / `formatVnd(next.spend_threshold)`
     — chúng nhiều thông tin hơn mockup.
   - Dữ liệu không đổi: vẫn `tierProgress(tiers, customer.lifetime_spend, customer)`.

3. **Bảng tổng hợp §1** — MỚI, đặt ngay sau hero. Năm dòng theo spec:

   | Dòng | Nguồn |
   |---|---|
   | Tổng tiền đã chi tiêu | `formatVnd(customer.lifetime_spend)` |
   | Tổng điểm đã nhận | `customer.lifetime_points` |
   | Điểm đã sử dụng | `totals.spent` từ **`getTransactionTotals(customer.id)`** |
   | Điểm hiện có | `customer.current_points` |
   | Hạng hiện tại | `current?.name ?? d.noTier` |

   ⚠️ **Dùng `getTransactionTotals`** (`src/lib/loyalty.ts`, `/history` đã dùng), **không** lấy
   `lifetime_points − current_points`: `adjust_points` ghi `current_delta` và `lifetime_delta`
   độc lập nên phép trừ có thể lệch sổ. Thêm vào `Promise.all` đang có.

   Render bằng `<dl>` 5 dòng `flex justify-between` + `divide-border` trong một `SectionCard` —
   **không** dùng `<table>`: 5 cặp nhãn/giá trị không cần tiêu đề cột và không cần cuộn ngang ở 360px.

4. **Card điểm danh** — giữ y nguyên, chỉ chuyển vị trí.

5. **Card vòng quay** — giữ y nguyên. Đây đã là mẫu "spin thành card dashboard"; `/spin` đã rời
   nav nên **nhớ thêm lối quay về `/dashboard`** trong `spin/page.tsx`.

6. **Quà nổi bật** — MỚI. `getFeaturedReward()` (`loyalty.ts`). Dùng `RewardCard` sẵn có + badge;
   tái dùng key `t.customer.rewards.featuredChip`, đừng đặt thêm chữ "HOT". Không có quà nổi bật
   thì không render gì (partial unique index đảm bảo nhiều nhất một).

7. **"Quà có thể đổi"** — giữ khối teaser hiện tại, thêm **lọc bỏ quà nổi bật** để không hiện hai
   lần (`rewards/page.tsx` đã có đúng một dòng làm việc này — copy sang).

8. **"Đơn hàng gần đây"** — đổi danh sách hiện tại thành **bảng 4 cột** từ `sm` trở lên, giữ
   danh sách ở điện thoại (đúng mẫu `/history` đang dùng).
   - Cột: **Mã Đơn** / **Ngày** / **Tổng** / **Điểm**.
   - "Tổng" đọc từ `transactions.meta.order_total` — `jsonb` không kiểu, hàng cũ trước `0011`
     không có → viết `orderTotal(row)` dò an toàn cạnh `adjustMeta` trong `loyalty.ts`,
     fallback `—`. Dòng không phải `EARN` cũng `—`.
   - Mã `TXN-`/`RDM-` đang được derive tại `history/page.tsx:100-105` → **tách ra helper dùng
     chung**, nếu không hai màn sẽ lệch nhau.
   - Giữ **mọi loại giao dịch**, không lọc riêng `EARN`: giao dịch đổi quà vẫn phải thấy ở đây.

9. **"Cập nhật mới" — 3 thẻ blog** — MỚI. `getPublishedPosts()` (`src/lib/blog.ts`) dùng client
   theo RLS và policy "anon read published posts" của `0020`, nên gọi từ RSC sau đăng nhập là an
   toàn. Lấy 3 bài đầu.
   - **Tách markup thẻ** từ `src/app/(public)/blog/page.tsx` ra `src/components/post-card.tsx`
     rồi dùng ở cả hai chỗ. ⚠️ Đặt tên `post-card`, **không** phải `blog-card` —
     `src/app/admin/blog/blog-card.tsx` đã tồn tại và là thứ khác.
   - Thêm "Xem tất cả" → `/blog`.
   - Chưa có bài nào thì cả khối phải biến mất sạch.

10. `(account)/loading.tsx` đang là `PageSkeleton stats={3}` — không còn khớp trang mở đầu bằng
    một hero rộng. Đổi `stats={0}` hoặc cho nhóm khách một skeleton riêng.

---

## 3. `/tiers` — dựng lại

File: `src/app/(customer)/(account)/tiers/page.tsx`
Mockup: `design/stitch-light/html/thuhang-dacquyen-vibrant-paw.html`

Giữ nguyên `tierAccentClass(rank)` bọc cả trang (để `--tier` có mặt ở mọi nơi).

1. **Header** — hiện đang là `ti.title(current.name)` ("Bạc member"). Đổi sang tiêu đề tĩnh
   `ti.pageTitle` ("Thăng Hạng & Đặc Quyền") + `ti.subtitle`, giữ chip `Gem` làm eyebrow. Tên
   hạng chuyển xuống card huy hiệu.

2. **Card "Hạng Hiện Tại"** (`md:col-span-5`) — dựng lại từ khối hero hiện có:
   - Huy hiệu `size-24 rounded-full` dùng `border-tier` / `bg-tier/10` / `text-tier` + `Gem`.
     Giữ vầng sáng trang trí `bg-tier/20 blur-3xl`.
   - Bên cạnh: `current.name` cỡ `headline-lg` màu `text-tier`, và `ti.memberSince(memberSince)`
     (key và formatter `Intl` đã có sẵn ở dòng 63–71).
   - Giữ `formatVnd(customer.lifetime_spend)` + `ti.spendLabel`, badge `ti.multiplier(...)`, và
     ghi chú grandfathered.
   - **MỚI, dưới một divider — "Chính sách duy trì":** icon `CalendarClock`, tiêu đề
     `ti.retentionTitle`, nội dung `ti.retentionBody(current.name)` mang câu 365 ngày.
     ⚠️ **Chỉ hiển thị.** Hệ thống KHÔNG cưỡng chế tụt hạng — `customers.tier_id` là "hạng cao
     nhất từng đạt, chỉ tăng". Viết như **chính sách chương trình**, tuyệt đối không viết như cam
     kết hệ thống, nếu không sẽ thành nguồn khiếu nại.
   - Giữ `MemberCardDialog`.
   - Bỏ danh sách `heroPerks` ra khỏi card này (mockup không có chỗ); bảng và panel bên dưới đã
     mang quyền lợi.

3. **Card "Tiến tới &lt;hạng kế&gt;"** (`md:col-span-7`):
   - Trái: `ti.progressTo(next.name)` (key mới) + một dòng mô tả.
   - Phải: `formatVnd(lifetime_spend)` `/` `formatVnd(next.spend_threshold)`, `tabular-nums`.
   - `<Progress value={progress/100} accent />` để cao hơn theo mockup.
   - Dưới đó dải nhấn: chip `ShoppingBag` + `ti.spendToNext(...)` (key đã có).
   - **Nhánh đỉnh thang:** giữ `TierRing percent={100} label={ti.maxLabel}` + `ti.atTop(...)`.
     `tiers/tier-ring.tsx` đáng giữ đúng cho ca này.

4. **Bảng "Quyền Lợi Hạng Thẻ"** (`md:col-span-12`) — thay lưới thẻ `othersTitle` hiện tại:
   - 3 cột: **Hạng Thẻ** / **Điều kiện & Tích lũy** / **Quyền lợi nổi bật**.
   - Mỗi hàng một tier từ `getTiers()` (đã sort theo ngưỡng, nên **index chính là rank**).
   - Cột 1: chip gem `tierAccentClass(index)` + `Gem` + `tier.name`; nếu `tier.id === current?.id`
     thì thêm `<Badge>{ti.currentChip}</Badge>` ("Hiện tại") và hàng được
     `bg-tier/5 border-l-4 border-l-tier`.
   - Cột 2: `ti.thresholdAt(formatVnd(tier.spend_threshold))` + pill `ti.multiplier(...)`.
   - Cột 3: 2 mục đầu của `tier.perks` (lấy `p.title`) với icon `CheckCircle`; `perks` rỗng thì
     rơi về `tier.benefits`.
   - Điện thoại: đổ thành danh sách thẻ dưới `sm`, đúng mẫu `/history`. Bảng 3 cột chữ tiếng Việt
     không nhét vừa 360px.

5. **Panel đặc quyền** — **giữ lại** khối `perksTitle` hiện có, chuyển xuống dưới bảng. Mockup gộp
   quyền lợi vào bảng, nhưng bảng chỉ hiện `perk.title`; panel này là **nơi duy nhất**
   `perk.detail` được render. Đây là sai lệch có chủ đích so với mockup.

`tier-accent.ts` và test của nó **không cần đổi** — màu gem theo rank nên không ảnh hưởng bởi việc
đổi ngưỡng.

---

## 4. Key i18n cần thêm

`en.ts` là nguồn, `vi.ts` được type theo nó → **mọi key phải có ở cả hai file**, và `vi` mới là
bản thực sự ship. `npm run typecheck` sẽ biến key thiếu thành lỗi biên dịch, đây là lưới an toàn
đáng tin nhất trong repo này.

**`t.customer.dashboard`**
`summaryTitle`, `summarySpend`, `summaryEarned`, `summaryUsed`, `summaryBalance`, `summaryTier`,
`ordersTitle`, `colOrder`, `colDate`, `colTotal`, `colPoints`, `noOrderTotal` (dấu `—`),
`updatesTitle`, `updatesViewAll`, `featuredTitle`.
Dùng lại không đổi: `greeting`, `petLine`, `addPetCta`, `balanceLabel`, `lifetimeSpend`,
`spendAway`, `topTier`, `percentComplete`, `tierProgressLabel`, `noTier`, `viewAll`, và toàn bộ
`checkin*` / `spin*`.

**`t.customer.tiers`**
`pageTitle`, `retentionTitle`, `retentionBody: (tierName: string) => …`,
`progressTo: (name: string) => …`, `progressCaption`, `benefitsTableTitle`, `colTier`,
`colCondition`, `colBenefits`, `currentChip`.
`othersTitle` sẽ thành key chết nếu lưới thẻ bị thay hẳn — **xoá ở cả hai file**, đừng để lại.

---

## 5. Cạm bẫy đã gặp — đọc trước khi code

1. **shadcn ở đây là Base UI, KHÔNG phải Radix.** `Button` không có `asChild`; muốn một `Link`
   trông như nút thì dùng `buttonVariants` (xem `src/components/page-link.tsx`).
2. **Đừng đụng `src/components/portal-nav.tsx`** — dùng chung với `/admin`, và
   `portal-nav.test.tsx` khẳng định bộ item của admin. Mọi thay đổi nav diễn đạt được bằng mảng
   `items` khác trong layout.
3. **Luôn dùng `resolveDisplayTier` / `tierProgress`**, không bao giờ dùng hạng thô mà chi tiêu
   kiếm được — thành viên được grandfather phải không bao giờ bị UI âm thầm hạ hạng.
4. **`--radius` là thang dùng chung.** Widget = `rounded-3xl` (32px), hero = `rounded-4xl` (48px),
   mọi chip/tab/CTA = `rounded-full`. Đừng viết giá trị tuỳ ý.
5. **Giữ `src/` sạch màu literal.** Ba lệnh này phải luôn rỗng:
   ```bash
   grep -rnE '#[0-9a-fA-F]{3,8}\b' src --include='*.tsx' --include='*.ts' | grep -v '\.test\.'
   grep -rnE 'rgba?\(' src --include='*.tsx'
   grep -rnE 'oklch\(|hsl\(' src --include='*.tsx'
   ```
6. **Cảnh báo hydration `data-theme` trong Next dev overlay là có sẵn từ trước**, đã kiểm chứng
   trên HEAD sạch (3 lỗi). Nguyên nhân là `ThemeInitScript` gắn thuộc tính trước khi React
   hydrate. **Đừng mất thời gian truy nó** khi làm hai trang này.
7. **DB hosted đã drift hai lần** so với ledger migration. Trước khi viết migration mới, query
   schema thật, đừng tin `seed.sql`. `customer_tier_history` chẳng hạn **không có cột `note`** và
   bắt buộc `tier_name`, `threshold_amount`, `spend_at_award`.
8. **`spend_threshold` là UNIQUE**, nên gán lại cả thang là bài toán phụ thuộc thứ tự. `0023`
   giải bằng **park-then-assign** (đẩy hết lên vùng tạm rồi mới gán) — tái dùng mẫu đó.
9. Trong `UPDATE ... FROM a LEFT JOIN b ON b.x = c.y`, Postgres **không cho** tham chiếu bảng đích
   `c` bên trong điều kiện JOIN. Tra cứu giá trị cũ bằng CTE hoặc subquery vô hướng.

---

## 6. Nghiệm thu

```bash
npm run typecheck   # bắt key vi.ts còn thiếu — giá trị nhất
npm run lint        # phải còn đúng 1 cảnh báo có sẵn, không hơn
npm run test
npm run build
npm run dev
```

Hai trang này đều **sau đăng nhập**, nên cần một phiên thật. Repo có sẵn
`mkcookie.mjs <email> <password>` để in ra cookie phiên cho `curl` mà không phải mở trình duyệt.

Đổi theme không cần bấm nút: `document.cookie = "theme=dark; path=/"` rồi reload. Nhớ thử cả
trạng thái **chưa chọn**: xoá cookie + devtools → Rendering → Emulate `prefers-color-scheme`.

Tạo 4 khách phủ hết nhánh — **bắt buộc** sau khi đổi thang hạng:

| Khách | Chi tiêu | Kỳ vọng |
|---|---|---|
| A | 500.000đ, `tier_id = null` | "chưa có hạng": dashboard ra `d.noTier`, `/tiers` ra `EmptyState` |
| B | 500.000đ, giữ Bạc | grandfathered: `/tiers` phải hiện `ti.grandfathered` |
| C | 2.500.000đ | giữa thang, thanh tiến độ đầy một phần, hiện "Vàng" |
| D | 45.000.000đ | đỉnh thang, `next === null`, `TierRing` ở MAX |

Thêm một khách không giao dịch (empty state) và một khách có ≥1 dòng `REDEEM` (để "Điểm đã sử
dụng" khác 0 và cột Tổng hiện `—`).

Soi ở **390px** và **1440px**, **cả hai theme**. Riêng bản tối: màu phải y hệt hôm nay, chỉ khác
bo góc / font / đổ bóng. Nếu bóng làm bẩn nền tối, cách rút lui rẻ là đặt `--shadow-color-*` của
khối tối thành `transparent` — bản tối về "không đổ bóng" mà không phải sửa một class nào.

**Regression bắt buộc:** `portal-nav.tsx` và shell admin ĐÃ bị đụng (rail thu gọn được, admin
chuyển từ `fixed` + `md:pl-64` sang shell flex/`sticky` như customer), nên phải soi lại: `/admin`
và `/admin/tiers` ở 1440 ở **cả hai** trạng thái thu gọn/mở rộng, `/dashboard` ở 390 và 1440, cả
hai theme. `/admin` cũng chưa từng được review trên nền sáng.

---

## 7. Điểm còn treo với khách hàng

1. **Hạ 4 ngưỡng và 3 hệ số là quyết định kinh doanh**, không phải sửa lỗi kỹ thuật — migration
   `0023` **đã chạy lên production**. Khách hiện tại tích điểm chậm hơn kể từ lúc deploy. Điểm đã
   cấp không đổi (`claim_points` đóng băng hệ số vào `transactions.meta`). Cần khách xác nhận.
2. **Câu chữ "duy trì 365 ngày"** — hệ thống không cưỡng chế. Chốt cách diễn đạt.
3. **3 câu FAQ về cát sắn** đang để "đang cập nhật" — cần khách cấp nội dung. Không được bịa
   thông tin về sản phẩm vật lý.
4. **§8.1 "1.000đ = 1 điểm" mâu thuẫn với code** (hệ thống tính theo SKU × hệ số hạng, đây là G1
   trong gap analysis, ngoài phạm vi đợt này). `/terms` hiện mô tả cơ chế thật và **cố ý không
   đăng công thức**. Khách cần biết spec và code đang lệch ở đây.
5. **Điều khoản voucher 15/30 ngày (§8.3.5)** cũng **cố ý không đăng** vì chưa có voucher engine
   (G4). Lý do đã ghi thành comment trong `src/app/(public)/terms/page.tsx`.
6. **Chính sách bảo mật** hiện là một mục neo `#privacy` trong `/terms`, không phải trang riêng.
   Nếu khách muốn trang riêng thì sửa link trong `register-form.tsx`.
7. **Bản tối sau đợt này là "màu stitch-v2 + hình dạng Vibrant Paw"** — chưa ai duyệt tổ hợp đó.
   Nên cho khách xem ảnh chụp bản tối trước khi nghiệm thu.
