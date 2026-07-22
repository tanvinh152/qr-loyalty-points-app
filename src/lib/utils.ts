import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Our type scale (`text-headline-lg`, `text-body-sm`, …) is defined in
// globals.css. tailwind-merge doesn't know those names, so it files them under
// text-COLOR and then drops the real color that came earlier in the class list —
// `text-primary-foreground text-body-sm` used to render as black text. Teaching
// it the font-size group keeps size and color as separate, non-conflicting
// utilities.
const FONT_SIZES = [
  "headline-lg",
  "headline-md",
  "body-lg",
  "body-sm",
  "label-md",
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Pancake prices are plain integers of đồng. The shop is Vietnamese, so the
// currency format is vi-VN regardless of the UI locale.
const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
})

export function formatVnd(amount: number): string {
  return vndFormatter.format(amount)
}
