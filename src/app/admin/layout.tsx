import Link from "next/link"
import { Gift, LogOut, Medal, Package, Settings } from "lucide-react"

import { InitialsAvatar } from "@/components/initials-avatar"
import { PortalNav, type PortalNavItem } from "@/components/portal-nav"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { logout } from "./login/actions"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.metaTitle }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getMessages()
  const nav = t.admin.nav
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Unauthenticated (login page). Middleware guards all other /admin routes.
  if (!user) return <>{children}</>

  // `/admin` is the only exact match: as a prefix it would light up on every
  // sub-route.
  const items: PortalNavItem[] = [
    { href: "/admin", label: nav.dashboard, icon: "dashboard", exact: true },
    { href: "/admin/tiers", label: nav.tiers, icon: "tiers" },
    { href: "/admin/products", label: nav.products, icon: "products" },
    { href: "/admin/rewards", label: nav.rewards, icon: "rewards" },
    { href: "/admin/customers", label: nav.customers, icon: "customers" },
    {
      href: "/admin/transactions",
      label: nav.transactions,
      icon: "transactions",
    },
    { href: "/admin/support", label: nav.support, icon: "support" },
  ]
  // The phone tab bar holds four, as the customer's does. The three it drops —
  // tiers, products and settings — move into the phone header, or those routes
  // would be unreachable on a phone.
  const bottomItems: PortalNavItem[] = [
    items[0],
    { href: "/admin/customers", label: nav.customers, icon: "customers" },
    {
      href: "/admin/transactions",
      label: nav.transactions,
      icon: "transactions",
    },
    { href: "/admin/support", label: nav.support, icon: "support" },
  ]
  const headerLinks = [
    { href: "/admin/rewards", label: nav.rewards, icon: Gift },
    { href: "/admin/products", label: nav.products, icon: Package },
    { href: "/admin/tiers", label: nav.tiers, icon: Medal },
    { href: "/admin/settings", label: nav.settings, icon: Settings },
  ]

  // The design shows a photo avatar; we only have an email, so initials stand in.
  const email = user.email ?? ""

  const brand = (
    <Link href="/admin" className="grid gap-1">
      <span className="text-headline-lg text-primary block">{nav.brand}</span>
      <span className="text-label-md text-muted-foreground uppercase">
        {nav.brandSub}
      </span>
    </Link>
  )

  return (
    <div className="min-h-svh">
      <aside className="bg-sidebar border-border fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r py-6 md:flex">
        <div className="px-6 pb-12">{brand}</div>

        <div className="px-3">
          <PortalNav items={items} label={nav.sidebarLabel} variant="rail" />
        </div>

        <div className="border-border mt-auto grid gap-4 border-t px-3 pt-6">
          <div className="grid gap-0.5">
            <Link
              href="/admin/settings"
              className="text-muted-foreground hover:bg-surface-container hover:text-foreground text-label-md flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
            >
              <Settings className="size-5" aria-hidden />
              {nav.settings}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="text-destructive hover:bg-destructive-container/50 text-label-md flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
              >
                <LogOut className="size-5" aria-hidden />
                {nav.signOut}
              </button>
            </form>
          </div>

          <div className="border-border/40 flex items-center gap-3 border-t px-1 pt-4">
            <InitialsAvatar name={email} size="lg" />
            <div className="min-w-0">
              <p className="text-label-md truncate font-bold">{email}</p>
              <p className="text-muted-foreground text-label-sm tracking-tight uppercase">
                {nav.role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Below md the sidebar is hidden. The header carries the brand, sign-out
          and the four destinations the tab bar has no room for. */}
      <header className="bg-sidebar border-border sticky top-0 z-30 border-b md:hidden">
        <div className="grid gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {brand}
            <form action={logout}>
              <button
                type="submit"
                className="text-destructive text-body-sm font-semibold"
              >
                {nav.signOut}
              </button>
            </form>
          </div>
          <nav aria-label={nav.mobileLabel} className="flex gap-1">
            {headerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.label}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <link.icon className="size-5" aria-hidden />
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="md:pl-64">
        {/* pb-28 keeps the last row clear of the phone tab bar. */}
        <div className="mx-auto max-w-[1280px] px-4 py-6 pb-28 sm:px-6 md:px-12 md:py-12 md:pb-12">
          {children}
        </div>
      </main>

      <div className="bg-sidebar border-border fixed inset-x-0 bottom-0 z-40 border-t md:hidden">
        <PortalNav
          items={bottomItems}
          label={nav.bottomLabel}
          variant="bottom"
        />
      </div>
    </div>
  )
}
