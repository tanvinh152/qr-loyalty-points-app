# Color Palette Documentation

This document specifies the color palettes and HEX codes for both the **Light Theme** and **Dark Theme** design systems.

---

## ☀️ Light Theme

Live in `src/app/globals.css` as `:root[data-theme="light"]` plus its
`@media (prefers-color-scheme: light)` mirror. The **Color Backgrounds** rows
below are reference swatches only — they are not wired to tokens.

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

Live in `src/app/globals.css` as the `:root` token block (the baseline theme),
but as the **accent** set only: `#0075e3` → `--primary-container`, `#04cdf8` →
`--ring`, `#001eb6` → `--brand`, `#f0f4f8` → `--foreground`.

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
