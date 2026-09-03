import * as React from "react"

import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import type { AppIcon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

// White field, 1px outline, focus tightens to a 1px primary ring — the Stitch
// inputs never glow. `icon` renders the leading glyph the designs put at
// `left-4`; the input itself keeps every prop it is given (FormControl clones
// `id`/`aria-*` onto this component and they must land on the <input>).
function Input({
  className,
  type,
  icon: Icon,
  ...props
}: React.ComponentProps<"input"> & { icon?: AppIcon }) {
  const input = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-card text-body-lg placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/20 aria-invalid:border-destructive aria-invalid:ring-destructive/15 h-12 w-full min-w-0 rounded-md border px-4 transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2",
        Icon && "pl-11",
        className,
      )}
      {...props}
    />
  )

  if (!Icon) return input

  return (
    // `AnimateIcon` drives any Animate UI glyph nested under it from the
    // WRAPPER's hover, which is the whole field — the 18px icon is
    // `pointer-events-none` and could never be hovered on its own. A lucide
    // glyph (still most call sites) simply ignores the context, so this is
    // safe for every `Input` that takes an icon. `asChild` so the wrapper
    // merges onto the existing relative div — the default renders an inline
    // `m.span`, which would put the field inside an inline box.
    <AnimateIcon animateOnHover asChild>
      <div className="relative">
        <Icon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2"
          aria-hidden
        />
        {input}
      </div>
    </AnimateIcon>
  )
}

export { Input }
