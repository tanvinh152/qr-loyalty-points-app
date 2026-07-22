import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Bordered white panel with a header strip (title + right-side actions) and an
 * optional footer strip. Wraps every admin table and dashboard panel — the
 * table itself is edge-to-edge, so it gets no padding of its own.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  footer,
  bodyClassName,
  className,
  children,
}: {
  title?: string
  description?: string
  /** Colored glyph leading the title — the customer screens' section marker. */
  icon?: LucideIcon
  actions?: React.ReactNode
  footer?: React.ReactNode
  bodyClassName?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "border-border bg-card overflow-hidden rounded-xl border",
        className,
      )}
    >
      {(title || actions) && (
        <div className="border-border flex flex-col gap-3 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            {title && (
              <h3 className="text-headline-md flex items-center gap-2">
                {Icon && <Icon className="text-primary size-5" aria-hidden />}
                {title}
              </h3>
            )}
            {description && (
              <p className="text-body-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
      {footer && (
        <div className="border-border/50 flex items-center justify-between gap-4 border-t px-6 py-3">
          {footer}
        </div>
      )}
    </section>
  )
}
