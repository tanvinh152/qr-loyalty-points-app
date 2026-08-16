import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { RewardKind } from "@/lib/db-types"

/**
 * The two kinds of gift, as links rather than client-side tabs: the grid below
 * is a server render per kind, so the tab IS the navigation. Button is Base UI
 * here, so there is no `asChild` — `buttonVariants` on a Link is the house
 * pattern (see `src/components/page-link.tsx`).
 */
export function KindTabs({
  active,
  search,
  labels,
}: {
  active: RewardKind
  /** Carried across so switching tabs does not silently drop the query. */
  search?: string
  labels: { redeem: string; spin: string }
}) {
  const tabs: { kind: RewardKind; label: string }[] = [
    { kind: "redeem", label: labels.redeem },
    { kind: "spin", label: labels.spin },
  ]

  return (
    <nav className="bg-surface-container flex w-fit gap-1 rounded-lg p-1">
      {tabs.map(({ kind, label }) => {
        const params = new URLSearchParams()
        if (kind !== "redeem") params.set("kind", kind)
        if (search) params.set("q", search)
        const query = params.toString()
        const current = kind === active

        return (
          <Link
            key={kind}
            href={query ? `/admin/rewards?${query}` : "/admin/rewards"}
            aria-current={current ? "page" : undefined}
            className={cn(
              buttonVariants({
                variant: current ? "default" : "ghost",
                size: "sm",
              }),
              !current && "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
