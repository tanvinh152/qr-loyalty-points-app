# Color Palette Documentation

This document specifies the color palettes and HEX codes for both the **Light Theme** and **Dark Theme** design systems.

---

## ☀️ Light Theme

Light is the BASELINE: it lives in `src/app/globals.css` as plain `:root`.
There is no `:root[data-theme="light"]` selector and no
`@media (prefers-color-scheme: light)` block — `data-theme="light"` works by
*not* matching the dark overrides. The **Color Backgrounds** rows below are
reference swatches only; they are not wired to tokens, and none of the Main
Palette hexes above ship either. What actually ships as light is the Azure Paw
set (`--primary #1000c7`, `--secondary #b80662`, `--background #fcf8ff`) —
see § Azure Paw below.

### Main Palette

* **Primary Blue:** `#0049ed`
* **Dark Navy:** `#00215b`
* **Accent Yellow:** `#fed700`
* **Light Surface / Off-White:** `#f0f4f8`
* **Teal / Cyan:** `#38c6bf`
* **Soft Mint:** `#aae8df`

### Color Backgrounds

| Row | HEX Code | Tone Description |
| :--- | :--- | :--- |
| **Row 1** | `#a1c9f5` | Light Sky Blue |
| | `#c6dffc` | Soft Pastel Blue |
| | `#d0e4fe` | Ice Blue |
| | `#d7e8fd` | Very Light Blue |
| **Row 2** | `#caf3ec` | Soft Mint |
| | `#c5efed` | Light Cyan |
| | `#c0d6db` | Muted Slate Blue |

---

## 🌙 Dark Theme

Dark is the OVERRIDE, carried by two selectors that hold identical values and
must be kept in sync: `@media (prefers-color-scheme: dark) { :root:not([data-theme]) }`
(OS default / no-JS) and `:root[data-theme="dark"]` (explicit choice).

This palette drives the **accents** only: `#0075e3` → `--primary-container`,
`#04cdf8` → `--ring`, `#001eb6` → `--brand`, `#f0f4f8` → `--foreground`.

The surfaces are deliberately NOT `#00082e` / `#000f5b` / `#001eb6`. Those were
tried as `--background` / `--card` / `--surface-highest` and made the whole app
read as saturated blue; the ladder is now a low-chroma neutral (`#0a1020` →
`#141b2e` → `#1e2740` → `#2a3550`) so the brand blue reads as an accent instead of
as the paper. Do not restore the navies onto surface tokens.

`--chicha-blue` (`#261cc1`) is likewise NOT from this palette: it is the logo
mark's own colour and is exempt from theme swaps.

### Main Palette

* **Text / Surface Light:** `#f0f4f8`
* **Vibrant Cyan:** `#04cdf8`
* **Bright Blue:** `#0075e3`
* **Deep Blue:** `#001eb6`
* **Dark Navy:** `#000f5b`
* **Base Background (Ultra Dark):** `#00082e`

### Color Backgrounds

| Level | HEX Code | Tone Description |
| :--- | :--- | :--- |
| **Highlight** | `#04cdf8` | Vibrant Cyan |
| **Primary** | `#0075e3` | Bright Blue |
| **Secondary** | `#001eb6` | Deep Blue |
| **Base / Dark** | `#000f5b` | Dark Navy |

---

## 📦 Xuất xứ hai bảng màu đang ship

> ⚠️ **Đây là bản chép duy nhất.** Hai bộ mockup gốc (`design/stitch-v2/`,
> `design/stitch-light/`) đã bị xoá ngày 2026-08-25 theo yêu cầu của khách, và
> `design/` nằm trong `.gitignore` nên **không có bản sao nào khác trong repo hay
> trong git history**. Đừng cố tra lại từ file — tra ở đây.

### Light = "Azure Paw"

Nguồn: Stitch project *Remix of Loyalty Rewards Dashboard*, design system
`azure_paw` — nay là bộ tham chiếu DUY NHẤT, ở
`design/stitch_remix_of_loyalty_rewards_dashboard/`.

Ship trong `:root`. Đầu mối: `--primary #1000c7`, `--primary-container #2f2fe4`,
`--secondary #b80662`, `--secondary-container #fd4b95`, `--background #fcf8ff`,
`--card #ffffff`, thang surface `#f5f2ff → #efecff → #e8e6fc → #e3e0f7`,
`--border #c6c4d9`, `--chicha-blue #001b8f`.

Chữ: **Plus Jakarta Sans** (variable 200–800, có subset `vietnamese` — bắt buộc
vì vi là locale mặc định).

Bóng: mọi shadow được nhuộm brand blue 2–20% alpha
(`--shadow-color-soft: rgb(47 47 228 / 0.05)` …) — đúng bằng `.widget-shadow`
của mockup.

### Dark = "Chicha Pet Members" (ĐÓNG BĂNG)

Nguồn: Stitch project `16205033762252629956`, tải 2026-07-21, từng nằm ở
`design/stitch-v2/`. **Khách chỉ cung cấp thiết kế sáng**, nên không có mockup
tối nào để dẫn xuất lại — bảng dưới đây là toàn bộ những gì còn lại về nó.
Đừng tái dựng bản tối từ Azure Paw.

| Vai trò | HEX |
| :--- | :--- |
| background / surface | `#10131a` |
| surface-container-lowest | `#0b0e15` |
| surface-container-low | `#191b23` |
| surface-container | `#1d2027` |
| surface-container-high | `#272a31` |
| surface-container-highest | `#32353c` |
| primary | `#d8e2ff` trên `#122f5f` |
| primary-container | `#4d8eff` |
| secondary (mint) | `#4edea3`, container `#00b47d` |
| tertiary | `#ffddb7`, container `#ffb95f` |
| outline | `#8e909a`, outline-variant `#44474f` |
| on-surface | `#e0e2ec`, on-surface-variant `#c4c6d0` |
| error | `#ffb4ab`, error-container `#93000a` |
| chicha-blue (chỉ logo) | `#261cc1` — fail contrast nếu dùng làm chữ hoặc viền |

Chữ gốc của bộ này là **Hanken Grotesk**; app đã chuyển sang Plus Jakarta Sans
cho cả hai theme trong đợt đồng bộ sáng. Thang bo góc gốc: 8px hairline · 12px
control · 1rem card · 2rem panel · 3rem hero.

Giá trị dark **thực tế đang ship** trong `globals.css` là bản đã hiệu chỉnh của
bộ trên (thang surface `#0a1020 → #141b2e → #1e2740 → #2a3550`, `--card #141b2e`)
cộng 4 accent từ § Dark Theme phía trên. Xem chính `globals.css` để lấy con số
đang chạy; bảng này là **xuất xứ**, không phải bản ghi hiện hành.

### Ghi chú tổ hợp chưa được duyệt

Bản tối hiện tại là **"màu stitch-v2 + hình dạng Azure Paw"** (bo góc / font /
đổ bóng theo bản sáng, màu theo bản tối cũ). Chưa ai duyệt tổ hợp đó — nên cho
khách xem ảnh chụp bản tối trước khi nghiệm thu.
