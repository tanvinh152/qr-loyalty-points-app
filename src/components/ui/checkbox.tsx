"use client"

import * as React from "react"

import {
  Checkbox as CheckboxPrimitive,
  CheckboxIndicator,
} from "@/components/animate-ui/primitives/radix/checkbox"
import { cn } from "@/lib/utils"

// The tick is drawn, not swapped: Animate UI's indicator is an always-mounted
// <svg> whose path animates `pathLength`, which replaces the lucide CheckIcon
// this file used to toggle. `data-checked:` still drives the BOX's colour —
// Radix keeps stamping `data-state="checked"` on the root, and that variant is
// paint, not presence, so unlike the dialog's `data-open:animate-*` it stays.
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive>) {
  return (
    <CheckboxPrimitive
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-xs border border-input transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        className,
      )}
      // Animate UI grows the box to 1.05 on hover. On a size-4 control sitting
      // in a form row that reads as jitter, and the `after:` pseudo-element
      // carrying the 44px touch target does not scale with it, so the visual
      // box and the tap box would drift apart. The press is kept.
      whileHover={{ scale: 1 }}
      {...props}
    >
      <CheckboxIndicator className="size-3.5" />
    </CheckboxPrimitive>
  )
}

export { Checkbox }
