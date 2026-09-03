"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FerrisWheel,
  Gift,
  HelpCircle,
  History,
  Home,
  LayoutDashboard,
  Medal,
  MessageSquare,
  Newspaper,
  Receipt,
  Settings,
  UserRound,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"

// The icons live here, not in the layouts: a lucide component is a function,
// and functions cannot cross the server -> client boundary. A layout passes a
// key instead. Both portals share the map — `tiers` and `rewards` mean the same
// thing on either side.
const ICONS = {
  // Customer
  home: Home,
  history: History,
  help: HelpCircle,
  profile: UserRound,
  spin: FerrisWheel,
  // Admin
  dashboard: LayoutDashboard,
  blog: Newspaper,
  customers: Users,
  transactions: Receipt,
  support: MessageSquare,
  settings: Settings,
  // Shared
  tiers: Medal,
  rewards: Gift,
} as const

export type PortalNavIcon = keyof typeof ICONS
export type PortalNavItem = {
  href: string
  label: string
  icon: PortalNavIcon
  /**
   * Match the path exactly instead of by prefix. Needed for a portal root like
   * `/admin`, which would otherwise light up on every sub-route.
   */
  exact?: boolean
}

/**
 * The navigation both portals render: a desktop rail whose active item is a
 * filled pill, and the phone tab bar from the mockups whose active item floats
 * its icon above the bar. Kept in one component so the two portals cannot drift
 * apart.
 */
export function PortalNav({
  items,
  label,
  variant,
  collapsed = false,
}: {
  items: PortalNavItem[]
  /** Accessible name — both variants can be in the DOM at once. */
  label: string
  /** `rail` = desktop sidebar, `bottom` = the phone tab bar. */
  variant: "rail" | "bottom"
  /**
   * Icons-only rail. Ignored by the `bottom` variant, which is never collapsed.
   * A real prop rather than a CSS `group-data` variant because `PortalNavItem`
   * is fully serializable (the icon is a string key — that is what ICONS is
   * for), so SidebarRail can render this from inside the client boundary; and
   * because `title` must be set ONLY when collapsed, which CSS cannot do.
   */
  collapsed?: boolean
}) {
  const pathname = usePathname()
  const bottom = variant === "bottom"

  return (
    <nav
      // Both variants render at once on small screens, so each needs its own
      // name or a screen reader sees two identical navigations.
      aria-label={label}
      className={cn(
        bottom
          ? // One column per item: the count is driven by the layout, not baked in.
            "grid h-20 auto-cols-fr grid-flow-col items-end"
          : "grid gap-1",
      )}
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = ICONS[item.icon]
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            // The label goes `sr-only` when collapsed, so the link keeps its
            // accessible name and needs no aria-label; `title` is what a
            // sighted mouse user gets instead.
            title={!bottom && collapsed ? item.label : undefined}
            className={cn(
              "duration-quick ease-out-quart transition-colors",
              bottom
                ? "relative grid h-full content-end justify-items-center gap-1 px-1 pb-3 text-center"
                : // A filled pill, per the Azure Paw rail. The old left bar
                  // plus tint said the same thing twice, and the bar could
                  // never hug the rail edge from inside the nav's gutter.
                  "text-body-sm flex items-center rounded-xl py-3",
              !bottom &&
                (collapsed ? "justify-center gap-0 px-0" : "gap-3 px-4"),
              active
                ? bottom
                  ? "text-primary"
                  : // The --sidebar-* pair, not --primary-container: its
                    // foreground is white in BOTH themes, where
                    // --primary-foreground on --primary-container is dark navy
                    // on bright blue in dark mode and fails contrast as text.
                    "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                : cn(
                    "text-muted-foreground",
                    bottom
                      ? "hover:text-foreground"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  ),
            )}
          >
            {bottom ? (
              // The active tab floats its icon above the bar as a filled bubble;
              // the inactive ones stay inline, so only the label row aligns.
              <span
                className={cn(
                  "duration-base ease-back-out grid place-items-center transition-all",
                  active
                    ? // Same token family as the rail's active pill; in both
                      // themes these resolve to the same hex the bubble already
                      // used. `border-sidebar` must stay — globals.css keeps
                      // --sidebar equal to this bar's background so the 4px
                      // ring punches through it.
                      "bg-sidebar-primary border-sidebar text-sidebar-primary-foreground -mt-7 mb-1 size-11 rounded-full border-4"
                    : "size-5",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
            ) : (
              <Icon className="size-5" aria-hidden />
            )}
            {bottom ? (
              // Two lines' worth of height whether the label needs one or two:
              // Vietnamese labels wrap at 10px in a ~90px column, and without a
              // reserved box the wrapped item pushes its icon out of line with
              // the others.
              <span className="text-label-sm flex h-7 items-end justify-center leading-[14px] font-bold break-words uppercase">
                {item.label}
              </span>
            ) : (
              // `sr-only`, never `hidden`: display:none would strip the link's
              // accessible name and leave a screen reader with a nameless icon.
              <span className={cn("truncate", collapsed && "sr-only")}>
                {item.label}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
