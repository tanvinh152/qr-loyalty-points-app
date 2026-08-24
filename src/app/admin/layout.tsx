import Link from "next/link"
import { LogOut, PawPrint } from "lucide-react"

import { AdminMenu } from "@/components/admin-menu"
import { InitialsAvatar } from "@/components/initials-avatar"
import { PortalHeader } from "@/components/portal-header"
import { PortalNav, type PortalNavItem } from "@/components/portal-nav"
import { SidebarProvider, SidebarRail } from "@/components/portal-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { getSidebarCollapsed } from "@/lib/sidebar/server"
import { type PortalTitle } from "@/lib/portal-title"
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

  const collapsed = await getSidebarCollapsed()

  // `/admin` is the only exact match: as a prefix it would light up on every
  // sub-route. Settings is one of these rather than a hand-rolled link under
  // the rail — as a special case it was the one destination that never lit up
  // when you were standing on it.
  const items: PortalNavItem[] = [
    { href: "/admin", label: nav.dashboard, icon: "dashboard", exact: true },
    { href: "/admin/tiers", label: nav.tiers, icon: "tiers" },
    { href: "/admin/products", label: nav.products, icon: "products" },
    { href: "/admin/rewards", label: nav.rewards, icon: "rewards" },
    { href: "/admin/blog", label: nav.blog, icon: "blog" },
    { href: "/admin/customers", label: nav.customers, icon: "customers" },
    {
      href: "/admin/transactions",
      label: nav.transactions,
      icon: "transactions",
    },
    { href: "/admin/support", label: nav.support, icon: "support" },
    { href: "/admin/settings", label: nav.settings, icon: "settings" },
  ]
  // The phone tab bar holds four, as the customer's does. The five it drops are
  // in AdminMenu, behind the avatar, or those routes would be unreachable on a
  // phone.
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

  // Every rail destination names a section; the header reads this to say which
  // one you are in, and to point the back chevron at it from a detail route
  // like /admin/customers/[id].
  const titles: PortalTitle[] = items

  // The design shows a photo avatar; we only have an email, so initials stand in.
  const email = user.email ?? ""

  // The admin brand is text only, so the rail borrows the member portal's paw
  // square — same ChiCha, no new asset.
  const brandMark = (
    <span className="bg-primary-container grid size-8 place-items-center rounded-xl">
      <PawPrint className="text-primary-foreground size-4" aria-hidden />
    </span>
  )

  return (
    <SidebarProvider initialCollapsed={collapsed}>
      <div className="bg-canvas flex min-h-svh">
        <SidebarRail
          items={items}
          navLabel={nav.sidebarLabel}
          brand={
            <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
              {brandMark}
              {/* One line at label size. A 32px title with a subtitle under it
                  used to live here; the role that subtitle named is on the
                  identity block at the foot of the rail, said once. */}
              <span className="text-label-lg truncate font-bold">
                {nav.brand}
              </span>
            </Link>
          }
          brandMark={
            <Link href="/admin" aria-label={nav.brand}>
              {brandMark}
            </Link>
          }
          footer={
            <div className="flex items-center gap-3 px-1 group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:px-0">
              <InitialsAvatar name={email} size="lg" />
              {/* hidden, not sr-only: this is not any control's name. */}
              <div className="min-w-0 group-data-[collapsed=true]/sidebar:hidden">
                <p className="text-label-md truncate font-bold">{email}</p>
                <p className="text-muted-foreground text-label-sm tracking-tight uppercase">
                  {nav.role}
                </p>
              </div>
            </div>
          }
        />

        <div className="flex min-w-0 grow flex-col">
          <PortalHeader
            titles={titles}
            backLabel={t.sidebar.back}
            brand={
              <Link
                href="/admin"
                className="flex min-w-0 items-center gap-2 md:hidden"
              >
                <PawPrint
                  className="text-primary size-5 shrink-0"
                  aria-hidden
                />
                <span className="text-headline-md truncate">{nav.brand}</span>
              </Link>
            }
            system={
              <>
                <ThemeToggle iconOnly className="max-md:hidden" />

                <form action={logout} className="max-md:hidden">
                  {/* Deliberately not `text-destructive`: signing out destroys
                      nothing, and the red read as an error in the chrome. */}
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={nav.signOut}
                    title={nav.signOut}
                  >
                    <LogOut className="size-4" aria-hidden />
                  </Button>
                </form>

                {/* Phone only — on desktop the rail's footer says who is signed
                    in, so the header does not repeat it. */}
                <AdminMenu email={email} className="md:hidden" />
              </>
            }
          />

          {/* The bottom pad clears the phone tab bar, its floating active bubble
              and the home indicator below it. */}
          <main className="mx-auto w-full max-w-[1280px] grow px-4 py-6 pb-[calc(--spacing(32)+env(safe-area-inset-bottom))] md:px-12 md:py-12 md:pb-12 lg:px-20">
            {children}
          </main>
        </div>

        <div className="bg-sidebar border-border fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
          <PortalNav
            items={bottomItems}
            label={nav.bottomLabel}
            variant="bottom"
          />
        </div>
      </div>
    </SidebarProvider>
  )
}
