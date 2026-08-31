"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { SidebarToggle } from "@/components/portal-sidebar"
import { resolvePortalTitle, type PortalTitle } from "@/lib/portal-title"

// The app bar both portals wear. It used to be hand-rolled twice, which is how
// /admin drifted to z-30, lost its safe-area insets and grew a different
// horizontal rhythm from the member portal; the same reasoning as PortalNav and
// PortalSidebar applies — one component so the two shells cannot disagree.
//
// A client component only because the section title comes from the pathname.
// Every slot is a ReactNode, so a server layout still passes server-rendered
// content straight through (the sign-out server-action forms, for one) — the
// same arrangement SidebarRail's `footer` slot already relies on.

export function PortalHeader({
  titles,
  backLabel,
  brand,
  context,
  system,
}: {
  /**
   * Route → section name. Serializable, so a server layout can build it from
   * the very array it hands PortalNav and the two can never disagree about
   * which section you are in.
   */
  titles: PortalTitle[]
  /** Accessible name for the back chevron on a detail route. */
  backLabel: string
  /** Phone-only brand block: from `md` up the rail carries the brand. */
  brand: React.ReactNode
  /** Portal-specific live context — the member portal's points and upgrade CTA. */
  context?: React.ReactNode
  /** Theme, sign-out, account menu. Split from `context` so the two can be
   * separated by a rule: five ungrouped controls in a row read as clutter. */
  system?: React.ReactNode
}) {
  const pathname = usePathname()
  const title = resolvePortalTitle(titles, pathname)

  return (
    // `min-h-16` rather than `h-16` because the safe-area inset adds to it on a
    // notched phone. On desktop `env()` is 0, so the bar is exactly 64px — the
    // same height as the rail's brand row, which is what makes the two bottom
    // rules meet instead of stepping at the corner.
    //
    // Deliberately NOT capped at <main>'s `max-w-[1280px]`: the bar is chrome,
    // not content. Centring its row inside that cap parks the toggle and the
    // account block hundreds of px in from the edges on a wide monitor — the
    // very dead space this padding was tightened to get rid of.
    <header className="bg-sidebar border-border sticky top-0 z-40 flex min-h-16 items-center border-b pt-[env(safe-area-inset-top)]">
      <div className="flex w-full items-center gap-3 px-4 md:px-6 lg:px-8">
        <SidebarToggle className="max-md:hidden" />

        {brand}

        {title && (
          <div className="flex min-w-0 items-center gap-1 max-md:hidden">
            {title.parent && (
              <Link
                href={title.parent}
                aria-label={backLabel}
                title={backLabel}
                className="text-muted-foreground hover:text-foreground hover:bg-surface-container -ml-1 grid size-7 shrink-0 place-items-center rounded-full transition-colors"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
            )}
            {/* A locator, not the page title — the page's own PageHeader is
                that, and shouting it twice at two sizes helps nobody. */}
            <h1 className="text-body-lg truncate font-semibold">
              {title.label}
            </h1>
          </div>
        )}

        <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-3">
          {context}
          {context && system && (
            <span
              aria-hidden
              className="bg-border h-5 w-px shrink-0 max-md:hidden"
            />
          )}
          {system}
        </div>
      </div>
    </header>
  )
}
