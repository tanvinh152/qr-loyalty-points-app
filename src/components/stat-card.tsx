import Link from "next/link"

import type { AppIcon } from "@/components/ui/icon"
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
  icon: AppIcon
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
        "border-border bg-card relative flex flex-col overflow-hidden rounded-2xl border p-5 sm:p-6",
        highlight && "border-primary-container/40 bg-primary-container/10",
        href &&
          "hover:border-primary/40 duration-quick ease-out-quart transition-[colors,transform,box-shadow] hover:-translate-y-0.5 hover:shadow-elevated",
        className,
      )}
    >
      {highlight && (
        <span
          aria-hidden
          className="bg-primary-container/20 pointer-events-none absolute -top-10 -right-10 size-32 rounded-full blur-3xl"
        />
      )}
      {/* Pinned rather than inline: the chip and the text sit side by side on a
          phone and stacked from `sm` up, and the badge belongs to the tile's
          corner in both. */}
      {badge && (
        <span className="absolute top-5 right-5 z-10 sm:top-6 sm:right-6">
          {badge}
        </span>
      )}
      {/* A phone has no room for the mockup's tall stack — the same tile turns
          into a row there and keeps the column from `sm` up. */}
      <div className="relative flex items-center gap-4 sm:block">
        <span
          className={cn(
            "bg-surface-container grid shrink-0 place-items-center rounded-xl",
            size === "display"
              ? "size-12 sm:size-16 sm:rounded-2xl"
              : "size-10 sm:size-12",
            tone === "primary" && "text-primary",
            tone === "secondary" && "text-secondary",
            tone === "neutral" && "text-muted-foreground",
            tone === "tier" && "text-tier",
          )}
        >
          <Icon
            className={
              size === "display" ? "size-6 sm:size-8" : "size-5 sm:size-6"
            }
            aria-hidden
          />
        </span>
        {/* Room for the pinned badge, which only shares the text's row on a
            phone — from `sm` it sits beside the chip instead. */}
        <div className={cn("min-w-0 flex-1 sm:mt-4", badge && "pr-16 sm:pr-0")}>
          <h3 className="text-label-md text-muted-foreground truncate tracking-wide uppercase">
            {label}
          </h3>
          <p
            className={cn(
              "mt-1 truncate tabular-nums",
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
        </div>
      </div>
    </Root>
  )
}
