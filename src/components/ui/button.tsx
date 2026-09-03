import { Slot as SlotPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import type { HTMLMotionProps } from "motion/react"

import { Button as ButtonPrimitive } from "@/components/animate-ui/primitives/buttons/button"
import { cn } from "@/lib/utils"

// NO "use client" IN THIS FILE, EVER. 15 server components call
// `buttonVariants()` to style a <Link>; a directive here turns every one of
// them into "Attempted to call buttonVariants() from the server" at runtime,
// which neither tsc nor vitest can see — only `npm run build` does. Rendering
// the client ButtonPrimitive from a directive-free module is fine: the import
// is what creates the boundary, and it creates it around the primitive only.

// Azure Paw buttons: solid primary, white-with-primary-border secondary,
// text-only tertiary. Radius is `rounded-md` (12px) — a rounded RECTANGLE, not a
// pill. DESIGN.md § Shapes reserves full rounding for chips, badges and search
// fields; every CTA in the four mockups is a rectangle. `onHero` is the one
// variant that cannot be read off the normal palette: it sits on the /dashboard
// hero gradient, where the surface ladder is invisible.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap duration-instant ease-out-quart transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
        // The auth CTA: brand indigo under a soft primary glow.
        brand: "bg-brand text-white shadow-glow hover:bg-brand/90",
        // ONLY for use inside a `bg-hero` surface: white plate, brand ink. Every
        // other variant reads its colour off the page's surface ladder, which
        // the hero gradient covers over — this is the inverse of `default`.
        // The ink is `--hero-from`, NOT `--primary`: on dark, --primary is a pale
        // tint and would put near-white text on the white plate (1.29:1).
        onHero:
          "bg-hero-ink text-hero-from hover:bg-hero-ink/90 focus-visible:ring-hero-ink/50",
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
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Render the child element instead of a `<button>`, merging props and ref
     * onto it. Reach for this ONLY inside a client component, where it buys
     * ref and handler merging — chiefly a Dialog / AlertDialog / DropdownMenu /
     * Tooltip trigger. For a link inside a SERVER component the house pattern
     * is still `cn(buttonVariants({…}))` on a `<Link>`: Button is a client
     * component, so `<Button asChild><Link/></Button>` would drag that whole
     * subtree across the client boundary for nothing.
     */
    asChild?: boolean
  }) {
  const classes = cn(buttonVariants({ variant, size, className }))

  // Radix's Slot, not Animate UI's: Animate UI merges as
  // `{...childProps, ...slotProps}`, so a slot prop OVERWRITES a child's own
  // handler instead of composing with it — `<Button asChild><Link onClick=…>`
  // would silently lose one. Radix composes. It also keeps button.test.tsx's
  // asChild case passing unchanged.
  if (asChild) {
    return (
      <SlotPrimitive.Slot
        data-slot="button"
        // Not forwarded unless asked for — the child element decides its own.
        {...(type ? { type } : null)}
        className={classes}
        {...props}
      />
    )
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      // A bare <button> defaults to type="submit"; Base UI's Button, which this
      // replaced, defaulted to "button", and Animate UI's primitive sets no
      // default at all. All 45 call sites were written against the old
      // contract, and the 20 of them that sit inside a <form> without an
      // explicit type would start submitting it. Keep the old default.
      type={type ?? "button"}
      // The press moved off `active:scale-[.98]` and onto Motion so there is
      // exactly one owner of `transform` — CSS and Motion both writing it
      // double-bounced the button mid-press. hoverScale is pinned to 1: Animate
      // UI's 1.05 default overflows the `xl` auth CTA (h-14 w-full) out of its
      // card and pushes bento buttons past their grid cell.
      hoverScale={1}
      tapScale={0.98}
      className={classes}
      {...(props as HTMLMotionProps<"button">)}
    />
  )
}

export { Button, buttonVariants }
