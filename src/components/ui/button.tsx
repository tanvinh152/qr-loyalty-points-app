import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Stitch buttons: solid primary, white-with-primary-border secondary, text-only
// tertiary. Radius is always `lg` (6px); only the claim CTA goes wider.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border bg-card text-foreground hover:bg-surface-container",
        // The design's secondary action is a white button outlined in primary.
        secondary: "border-primary bg-card text-primary hover:bg-accent",
        // Filled blue — the claim confirm CTA.
        accent: "bg-secondary text-secondary-foreground hover:bg-primary",
        ghost:
          "text-muted-foreground hover:bg-surface-container hover:text-foreground",
        destructive:
          "text-destructive hover:bg-destructive-container/50 focus-visible:ring-destructive/30",
        muted: "bg-surface-container text-foreground hover:bg-surface-high",
        // The auth CTA: brand indigo under a soft primary glow (dangnhap.html).
        brand:
          "bg-brand text-white shadow-[0_0_20px_rgba(173,198,255,0.4)] hover:bg-brand/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-body-sm",
        xs: "h-6 px-2 text-label-md [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-label-md [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-5 text-body-sm",
        // Full-bleed form CTA (`py-4` in claim-page.html).
        xl: "h-14 w-full px-6 text-body-lg",
        icon: "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
