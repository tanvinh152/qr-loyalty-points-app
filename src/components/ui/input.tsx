import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import type { LucideIcon } from "lucide-react"

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
}: React.ComponentProps<"input"> & { icon?: LucideIcon }) {
  const input = (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-card text-body-lg placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/20 aria-invalid:border-destructive aria-invalid:ring-destructive/15 h-11 w-full min-w-0 rounded-lg border px-4 transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2",
        Icon && "pl-11",
        className,
      )}
      {...props}
    />
  )

  if (!Icon) return input

  return (
    <div className="relative">
      <Icon
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2"
        aria-hidden
      />
      {input}
    </div>
  )
}

export { Input }
