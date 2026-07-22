import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Chevron pager button for a table footer.
 * Renders as a dimmed, inert span when there is no page to go to — a disabled
 * link is not focusable, so nothing is lost by dropping the anchor.
 */
export function PageLink({
  href,
  disabled,
  direction,
  label,
}: {
  href: string
  disabled?: boolean
  direction: "prev" | "next"
  /** Accessible name — the button itself is icon-only. */
  label: string
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  const className = cn(
    buttonVariants({ variant: "outline", size: "icon-sm" }),
    "text-muted-foreground",
  )

  if (disabled) {
    return (
      <span className={cn(className, "opacity-30")} aria-hidden>
        <Icon className="size-[18px]" />
      </span>
    )
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      <Icon className="size-[18px]" aria-hidden />
    </Link>
  )
}
