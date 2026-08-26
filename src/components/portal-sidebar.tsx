"use client"

import { createContext, useContext, useState } from "react"
import Link from "next/link"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { PortalNav, type PortalNavItem } from "@/components/portal-nav"
import { setSidebarCollapsed } from "@/lib/sidebar/actions"
import { useT } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

// The desktop rail, shared by both portals — the same reasoning as portal-nav:
// kept in one component so /admin and the member portal cannot drift apart.
//
// The toggle lives in the HEADER while the rail is an <aside>, so the two are
// siblings rather than parent and child and the state has to be context. The
// provider wraps each layout; its children are server-rendered, which is fine —
// their output lands inside the provider's tree, so any client descendant can
// read the context.

type SidebarContextValue = {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within <SidebarProvider>")
  return ctx
}

export function SidebarProvider({
  initialCollapsed,
  children,
}: {
  /** From `getSidebarCollapsed()` — server-resolved, so the rail renders at its
   * real width in the first HTML and never snaps after hydration. */
  initialCollapsed: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  const toggle = () => {
    const next = !collapsed
    // Local state is authoritative for this session; the cookie is only for the
    // NEXT request. Deliberately no router.refresh() — unlike the theme, nothing
    // server-rendered depends on this, and a refresh would re-run the layout's
    // account/tier queries on every click.
    setCollapsed(next)
    void setSidebarCollapsed(next)
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

/**
 * The collapse switch. Belongs in the header, where it stays put and legible at
 * either width — a bottom-pinned toggle has nowhere to sit once the rail is
 * 64px wide. Hidden below `md` by the caller: there is no rail on a phone.
 */
export function SidebarToggle({ className }: { className?: string }) {
  const { collapsed, toggle } = useSidebar()
  const t = useT().sidebar
  const label = collapsed ? t.expand : t.collapse
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn("shrink-0", className)}
    >
      <Icon className="size-5" aria-hidden />
    </Button>
  )
}

/**
 * The rail's pinned bottom CTA (the mockups' "Upgrade Tier"). A client
 * component rather than another server-rendered `footer` slot for one reason:
 * `title` must be set ONLY while collapsed, and CSS cannot express that — the
 * same rule PortalNav's rail links follow.
 *
 * Portal-agnostic on purpose: /admin has no CTA, and the icon arrives as an
 * ELEMENT because a lucide function cannot cross the RSC boundary.
 */
export function SidebarCta({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: React.ReactNode
}) {
  const { collapsed } = useSidebar()

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        buttonVariants({
          variant: "muted",
          size: collapsed ? "icon" : "default",
        }),
        collapsed ? "mx-auto" : "w-full justify-start gap-3",
      )}
    >
      {icon}
      {/* sr-only, NEVER hidden: display:none strips the link's accessible name
          and leaves a screen reader a nameless icon. */}
      <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
    </Link>
  )
}

export function SidebarRail({
  items,
  navLabel,
  brand,
  brandMark,
  footer,
  className,
}: {
  items: PortalNavItem[]
  /** Accessible name for the rail's <nav>. */
  navLabel: string
  /** The full brand block, shown while expanded. Sized for a 64px row: one
   * line, no subtitle. Whatever else the portal wants to say about who you are
   * belongs in `footer`, where there is room for it. */
  brand: React.ReactNode
  /** The mark alone, shown at 64px in place of `brand`. */
  brandMark: React.ReactNode
  /** Server-rendered identity block pinned to the bottom (avatar + who you are). */
  footer?: React.ReactNode
  /** Escape hatch. NOT for padding: horizontal padding belongs to this
   * component because it has to shrink with the rail — a caller could not
   * express that, since `group-data` variants match descendants, never the
   * group element itself, so a class on the <aside> cannot react to its own
   * state — and the vertical rhythm is now fixed by the 64px brand row. */
  className?: string
}) {
  const { collapsed } = useSidebar()

  return (
    <aside
      // `group/sidebar` + this attribute are the contract the server-rendered
      // `footer` styles against with `group-data-[collapsed=true]/sidebar:*`.
      // Props would mean turning those slots — which hold server-action forms —
      // into client components for nothing.
      data-collapsed={collapsed ? "true" : undefined}
      className={cn(
        // Three fixed zones rather than one scrolling column: only the nav may
        // scroll, so the brand and the identity block stay put.
        "bg-sidebar border-border shadow-nav group/sidebar sticky top-0 hidden h-svh shrink-0 flex-col border-r transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Exactly the header's height, with the same rule under it. That is the
          whole point of this row: the two borders meet across the corner and
          read as one line, instead of stepping where the rail joins the bar. */}
      <div
        className={cn(
          "border-border flex h-16 shrink-0 items-center border-b",
          collapsed ? "justify-center px-1" : "px-3",
        )}
      >
        <div className="min-w-0 group-data-[collapsed=true]/sidebar:hidden">
          {brand}
        </div>
        <div className="hidden group-data-[collapsed=true]/sidebar:block">
          {brandMark}
        </div>
      </div>

      {/* At 64px the rows have only the rail minus this padding to work with,
          so the gutter shrinks to keep the 20px icon centred. */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto py-4",
          collapsed ? "px-1" : "px-3",
        )}
      >
        <PortalNav
          items={items}
          label={navLabel}
          variant="rail"
          collapsed={collapsed}
        />
      </div>

      {footer && (
        <div
          className={cn(
            "border-border shrink-0 border-t py-4",
            collapsed ? "px-1" : "px-3",
          )}
        >
          {footer}
        </div>
      )}
    </aside>
  )
}
