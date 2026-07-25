import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Dashboard summary tile: icon chip and optional trend pill on one row, then the
 * `label-md` overline and the big number.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  size = "default",
  badge,
  highlight = false,
  href,
  className,
}: {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  /** `tier` reads `--tier` from an enclosing `tierAccentClass` wash. */
  tone?: "primary" | "secondary" | "neutral" | "tier"
  /** `display` is the hero pair the dashboard opens on — bigger chip and number. */
  size?: "default" | "display"
  badge?: React.ReactNode
  /** The promoted tile in a row — tinted surface plus a corner glow. */
  highlight?: boolean
  /** Makes the whole tile a link to the screen the number came from. */
  href?: string
  className?: string
}) {
  // The tile is one target either way; a link version would otherwise need its
  // own copy of the whole body.
  const Root = href ? Link : "div"

  return (
    <Root
      // `href` is only read when Root is Link, but the union needs it either way.
      href={href as string}
      className={cn(
        "border-border bg-card relative flex flex-col overflow-hidden rounded-2xl border p-6",
        highlight && "border-primary-container/40 bg-primary-container/10",
        href && "hover:border-primary/40 transition-colors",
        className,
      )}
    >
      {highlight && (
        <span
          aria-hidden
          className="bg-primary-container/20 pointer-events-none absolute -top-10 -right-10 size-32 rounded-full blur-3xl"
        />
      )}
      <div className="relative mb-4 flex items-center justify-between">
        <span
          className={cn(
            "bg-surface-container grid place-items-center rounded-xl",
            size === "display" ? "size-16 rounded-2xl" : "size-12",
            tone === "primary" && "text-primary",
            tone === "secondary" && "text-secondary",
            tone === "neutral" && "text-muted-foreground",
            tone === "tier" && "text-tier",
          )}
        >
          <Icon
            className={size === "display" ? "size-8" : "size-6"}
            aria-hidden
          />
        </span>
        {badge}
      </div>
      <h3 className="text-label-md text-muted-foreground relative tracking-wide uppercase">
        {label}
      </h3>
      <p
        className={cn(
          "relative mt-1 tabular-nums",
          size === "display"
            ? // The hero pair takes the tile's own colour; the default tile
              // keeps the neutral heading it has everywhere else.
              cn(
                "text-headline-lg md:text-display",
                tone === "primary" && "text-primary",
                tone === "secondary" && "text-secondary",
                tone === "tier" && "text-tier",
              )
            : "text-headline-lg",
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint && (
        <p className="text-muted-foreground mt-1 text-body-xs">{hint}</p>
      )}
    </Root>
  )
}
