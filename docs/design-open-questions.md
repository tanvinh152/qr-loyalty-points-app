# Cạm bẫy kỹ thuật & điểm treo với khách

> Thay cho `docs/vibrant-paw-remaining-work.md` (viết 2026-08-23, xoá 2026-08-25).
> Các mục §1–§4 của file cũ mô tả công việc dựng lại `/dashboard` và `/tiers` —
> đã hoàn thành, và trỏ vào các thư mục mockup nay đã bị xoá. Hai phần dưới đây
> là phần còn nguyên giá trị.

---

## 1. Cạm bẫy đã gặp — đọc trước khi code

1. **shadcn ở đây là Base UI, KHÔNG phải Radix.** `Button` không có `asChild`; muốn một `Link`
   trông như nút thì dùng `buttonVariants` (xem `src/components/page-link.tsx`).
2. **Đừng đụng `src/components/portal-nav.tsx`** — dùng chung với `/admin`, và
   `portal-nav.test.tsx` khẳng định bộ item của admin. Mọi thay đổi nav diễn đạt được bằng mảng
   `items` khác trong layout.
3. **Luôn dùng `resolveDisplayTier` / `tierProgress`**, không bao giờ dùng hạng thô mà chi tiêu
   kiếm được — thành viên được grandfather phải không bao giờ bị UI âm thầm hạ hạng.
4. **`--radius` là thang dùng chung.** Widget = `rounded-3xl` (32px), hero = `rounded-4xl` (48px),
   nút/input = `rounded-md` (12px), chip/badge = `rounded-full`. Đừng viết giá trị tuỳ ý.
5. **Giữ `src/` sạch màu literal.** Ba lệnh này phải luôn rỗng:
   ```bash
   grep -rnE '#[0-9a-fA-F]{3,8}\b' src --include='*.tsx' --include='*.ts' | grep -v '\.test\.'
   grep -rnE 'rgba?\(' src --include='*.tsx'
   grep -rnE 'oklch\(|hsl\(' src --include='*.tsx'
   ```
6. **Cảnh báo hydration `data-theme` trong Next dev overlay là có sẵn từ trước**, đã kiểm chứng
   trên HEAD sạch (3 lỗi). Nguyên nhân là `ThemeInitScript` gắn thuộc tính trước khi React
   hydrate. **Đừng mất thời gian truy nó.**
7. **DB hosted đã drift hai lần** so với ledger migration. Trước khi viết migration mới, query
   schema thật, đừng tin `seed.sql`. `customer_tier_history` chẳng hạn **không có cột `note`** và
   bắt buộc `tier_name`, `threshold_amount`, `spend_at_award`.
8. **`spend_threshold` là UNIQUE**, nên gán lại cả thang là bài toán phụ thuộc thứ tự. `0023`
   giải bằng **park-then-assign** (đẩy hết lên vùng tạm rồi mới gán) — tái dùng mẫu đó.
9. Trong `UPDATE ... FROM a LEFT JOIN b ON b.x = c.y`, Postgres **không cho** tham chiếu bảng đích
   `c` bên trong điều kiện JOIN. Tra cứu giá trị cũ bằng CTE hoặc subquery vô hướng.
10. **Mockup không phải nguồn sự thật về dữ liệu.** Bộ Azure Paw vẽ danh mục blog
    ("Cẩm Nang / Sự Kiện / Review") và form đăng ký (bỏ email, mã đơn "tùy chọn") **mâu thuẫn với
    schema và với `signUp`**. Port hình thức, giữ dữ liệu của app. Chi tiết trong
    `design/stitch_remix_of_loyalty_rewards_dashboard/README.md`.

---

## 2. Điểm còn treo với khách hàng

1. **Hạ 4 ngưỡng và 3 hệ số là quyết định kinh doanh**, không phải sửa lỗi kỹ thuật — migration
   `0023` **đã chạy lên production**. Khách hiện tại tích điểm chậm hơn kể từ lúc deploy. Điểm đã
   cấp không đổi (`claim_points` đóng băng hệ số vào `transactions.meta`). Cần khách xác nhận.
2. **Câu chữ "duy trì 365 ngày"** — hệ thống KHÔNG cưỡng chế tụt hạng (`customers.tier_id` là
   "hạng cao nhất từng đạt, chỉ tăng"). `/tiers` viết nó như **chính sách chương trình**, tuyệt
   đối không viết như cam kết hệ thống. Chốt cách diễn đạt với khách.
3. **3 câu FAQ về cát sắn** đang để "đang cập nhật" — cần khách cấp nội dung. Không được bịa
   thông tin về sản phẩm vật lý.
4. **§8.1 "1.000đ = 1 điểm" mâu thuẫn với code** (hệ thống tính theo SKU × hệ số hạng, đây là G1
   trong gap analysis). `/terms` hiện mô tả cơ chế thật và **cố ý không đăng công thức**. Khách
   cần biết spec và code đang lệch ở đây.
5. **Điều khoản voucher 15/30 ngày (§8.3.5)** cũng **cố ý không đăng** vì chưa có voucher engine
   (G4). Lý do đã ghi thành comment trong `src/app/(public)/terms/page.tsx`.
6. **Chính sách bảo mật** hiện là một mục neo `#privacy` trong `/terms`, không phải trang riêng.
   Nếu khách muốn trang riêng thì sửa link trong `register-form.tsx`.
7. **Bản tối chưa ai duyệt.** Nó là tổ hợp "màu Chicha Pet Members cũ + hình dạng Azure Paw" —
   không có mockup tối nào tồn tại. Cho khách xem ảnh chụp bản tối trước khi nghiệm thu.
8. **Ba màn không có mockup**: `/history`, `/help`, `/profile`, `/rewards` (shop), `/spin` và toàn
   bộ `/admin`. Mockup cũ của chúng đã bị xoá cùng `stitch-v2`. Dựng theo `azure_paw/DESIGN.md`.
