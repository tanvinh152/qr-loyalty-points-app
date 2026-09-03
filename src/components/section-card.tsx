import type { AppIcon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/**
 * Bordered white panel with a header strip (title + right-side actions) and an
 * optional footer strip. Wraps every admin table and dashboard panel — the
 * table itself is edge-to-edge, so it gets no padding of its own.
 *
 * `chrome` picks between the two header treatments the design uses:
 *   - `framed` (default) — coloured icon + a rule under the header. This is what
 *     /admin is built on; do NOT change the default.
 *   - `plain` — bare heading and a text action, no icon and no rule. Every card
 *     header in the Azure Paw mockups is this one.
 * An icon passed alongside `chrome="plain"` is ignored rather than silently
 * half-rendered.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  footer,
  chrome = "framed",
  bodyClassName,
  className,
  children,
}: {
  title?: string
  description?: string
  /** Colored glyph leading the title. Ignored when `chrome="plain"`. */
  icon?: AppIcon
  actions?: React.ReactNode
  footer?: React.ReactNode
  chrome?: "framed" | "plain"
  bodyClassName?: string
  className?: string
  children: React.ReactNode
}) {
  const plain = chrome === "plain"
  return (
    <section
      className={cn(
        "border-border bg-card shadow-soft overflow-hidden rounded-3xl border",
        className,
      )}
    >
      {(title || actions) && (
        <div
          className={cn(
            "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6",
            plain ? "pb-0 sm:pb-0" : "border-border border-b",
          )}
        >
          <div className="grid gap-1">
            {title && (
              <h3 className="text-headline-md flex items-center gap-2">
                {!plain && Icon && (
                  <Icon className="text-primary size-5" aria-hidden />
                )}
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
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:gap-4 sm:px-6">
          {footer}
        </div>
      )}
    </section>
  )
}
