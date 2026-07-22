"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Gift,
  HelpCircle,
  History,
  Home,
  LayoutDashboard,
  Medal,
  MessageSquare,
  Package,
  QrCode,
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
  scan: QrCode,
  history: History,
  help: HelpCircle,
  profile: UserRound,
  // Admin
  dashboard: LayoutDashboard,
  products: Package,
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
 * The navigation both portals render: a desktop rail marked by a left bar, and
 * the phone tab bar from the mockups whose active item floats its icon above
 * the bar. Kept in one component so the two portals cannot drift apart.
 */
export function PortalNav({
  items,
  label,
  variant,
}: {
  items: PortalNavItem[]
  /** Accessible name — both variants can be in the DOM at once. */
  label: string
  /** `rail` = desktop sidebar, `bottom` = the phone tab bar. */
  variant: "rail" | "bottom"
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
            className={cn(
              "transition-colors",
              bottom
                ? "text-label-sm relative grid justify-items-center gap-1 pb-3 text-center font-bold uppercase"
                : // The active rail item is marked by a left bar, not a filled
                  // pill, so the row keeps the mockup's flush-left rhythm.
                  "text-body-sm flex items-center gap-3 rounded-r-xl border-l-4 px-4 py-3",
              active
                ? bottom
                  ? "text-primary"
                  : "border-primary bg-primary/15 text-foreground font-semibold"
                : cn(
                    "text-muted-foreground hover:text-foreground hover:bg-surface-high",
                    !bottom && "border-transparent",
                  ),
            )}
          >
            {bottom ? (
              // The active tab floats its icon above the bar as a filled bubble;
              // the inactive ones stay inline, so only the label row aligns.
              <span
                className={cn(
                  "grid place-items-center transition-all",
                  active
                    ? "bg-primary-container border-sidebar text-primary-foreground -mt-8 mb-1 size-12 rounded-full border-4"
                    : "size-5",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
            ) : (
              <Icon className="size-5" aria-hidden />
            )}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
