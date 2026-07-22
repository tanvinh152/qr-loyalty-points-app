import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Status chip: the tone at ~10-20% behind solid text, 10px bold uppercase,
// 4px radius (`rounded-md` in this scale).
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap uppercase [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-primary/15 bg-accent text-accent-foreground",
        outline: "border-border bg-card text-foreground",
        muted: "border-border bg-surface-container text-muted-foreground",
        success: "border-success/20 bg-success/12 text-success",
        warning: "border-warning/20 bg-warning/15 text-warning",
        destructive: "border-destructive/20 bg-destructive/12 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
