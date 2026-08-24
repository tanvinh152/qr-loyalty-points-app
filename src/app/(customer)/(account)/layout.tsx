import Link from "next/link"
import { LogOut, PawPrint, Sparkles, TrendingUp, UserX } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { AccountMenu } from "@/components/account-menu"
import { EmptyState } from "@/components/empty-state"
import { InitialsAvatar } from "@/components/initials-avatar"
import { PortalFooter } from "@/components/portal-footer"
import { PortalHeader } from "@/components/portal-header"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/server"
import { getSidebarCollapsed } from "@/lib/sidebar/server"
import { getTiers, resolveDisplayTier } from "@/lib/loyalty"
import { signOut } from "../auth/actions"
import { type PortalNavItem, PortalNav } from "@/components/portal-nav"
import { type PortalTitle } from "@/lib/portal-title"
import { SidebarProvider, SidebarRail } from "@/components/portal-sidebar"
import { getAccount } from "./account"

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getMessages()
  const nav = t.customer.nav
  const { customer } = await getAccount()
  const collapsed = await getSidebarCollapsed()

  // The Vibrant Paw mockups carry exactly four destinations, in this order, and
  // the rail and the phone bar carry the SAME four. Everything that used to be
  // a fifth or sixth rail item now has a specific home:
  //   /profile → the rail's identity footer (desktop) / AccountMenu (phone)
  //   /help    → PortalFooter, with /faq, /terms and /blog
  //   /spin    → the dashboard card, the way check-in already works
  // If you add a fifth item here, the mockups have no pattern for it — design
  // an overflow affordance rather than letting the bar grow.
  const items: PortalNavItem[] = [
    { href: "/dashboard", label: nav.home, icon: "home" },
    { href: "/tiers", label: nav.tiers, icon: "tiers" },
    { href: "/rewards", label: nav.rewards, icon: "rewards" },
    { href: "/history", label: nav.history, icon: "history" },
  ]

  // What the header calls the section you are in. The four nav destinations
  // plus the three routes that deliberately have no rail item — without them
  // the header would go blank on exactly the pages reached from the avatar.
  const titles: PortalTitle[] = [
    ...items,
    { href: "/profile", label: nav.profile },
    { href: "/help", label: nav.help },
    { href: "/spin", label: nav.spin },
  ]

  // The display tier, not the one the spend earns: a member kept on an old
  // threshold must never see the rail quietly demote them.
  const tierName = customer
    ? (resolveDisplayTier(await getTiers(), customer)?.name ?? null)
    : null

  // The paw square is both the mark inside the expanded brand block and, on its
  // own, the whole brand at 64px.
  const brandMark = (
    <span className="bg-primary-container grid size-8 place-items-center rounded-xl">
      <PawPrint className="text-primary-foreground size-4" aria-hidden />
    </span>
  )

  return (
    <SidebarProvider initialCollapsed={collapsed}>
      <div className="bg-canvas flex min-h-svh">
        {/* Desktop rail. The upgrade CTA and sign-out that used to be pinned to
            its bottom are in the header now — at EVERY width, where they used
            to be desktop-only — and the bottom carries the member instead. */}
        <SidebarRail
          items={items}
          navLabel={nav.mainLabel}
          brand={
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-2.5"
            >
              {brandMark}
              {/* One line, at label size. At `text-headline-md` the brand wrapped
                  in a 190px column and the mark ended up centred against the
                  wrong line of it. */}
              <span className="text-label-lg truncate font-bold">
                {t.brand.name}
              </span>
            </Link>
          }
          brandMark={
            <Link href="/dashboard" aria-label={t.brand.name}>
              {brandMark}
            </Link>
          }
          footer={
            customer && (
              <Link
                href="/profile"
                aria-label={nav.avatarLabel}
                className="hover:bg-surface-high flex items-center gap-3 rounded-xl px-1 py-1 transition-colors group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:px-0"
              >
                <InitialsAvatar
                  name={customer.full_name ?? customer.phone}
                  size="lg"
                />
                <div className="min-w-0 group-data-[collapsed=true]/sidebar:hidden">
                  <p className="text-label-md truncate font-bold">
                    {customer.full_name ?? customer.phone}
                  </p>
                  {tierName && (
                    <p className="text-primary text-label-sm truncate uppercase">
                      {tierName}
                    </p>
                  )}
                </div>
              </Link>
            )
          }
        />

        <div className="flex min-w-0 grow flex-col">
          <PortalHeader
            titles={titles}
            backLabel={t.sidebar.back}
            brand={
              <Link
                href="/dashboard"
                className="flex min-w-0 items-center gap-2 md:hidden"
              >
                <PawPrint
                  className="text-primary size-5 shrink-0"
                  aria-hidden
                />
                <span className="text-headline-md truncate">
                  {t.brand.name}
                </span>
              </Link>
            }
            context={
              customer && (
                <>
                  <span className="bg-surface-high text-label-md text-primary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 whitespace-nowrap">
                    <Sparkles className="size-4" aria-hidden />
                    {customer.current_points.toLocaleString()}
                    {/* Dropped on the narrowest phones so a six-figure balance
                        cannot push the avatar off the row. */}
                    <span className="max-sm:hidden">{nav.pointsUnit}</span>
                  </span>

                  {/* md+ only: below it, this lives in AccountMenu. */}
                  <Link
                    href="/tiers"
                    className={cn(
                      buttonVariants({ variant: "muted", size: "sm" }),
                      "shrink-0 max-md:hidden",
                    )}
                  >
                    <TrendingUp className="size-4" aria-hidden />
                    {nav.upgradeCta}
                  </Link>
                </>
              )
            }
            system={
              <>
                <ThemeToggle iconOnly className="max-md:hidden" />

                <form action={signOut} className="max-md:hidden">
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

                {/* Phone only — on desktop the rail's footer is where the
                    member is, and two avatars on one screen is the clutter
                    this pass exists to remove. */}
                {customer && (
                  <AccountMenu
                    name={customer.full_name ?? customer.phone}
                    className="md:hidden"
                  />
                )}
              </>
            }
          />

          {/* The bottom pad clears the phone tab bar, its floating active bubble
              and the home indicator below it. */}
          <main className="mx-auto w-full max-w-[1280px] grow px-4 py-6 pb-[calc(--spacing(32)+env(safe-area-inset-bottom))] md:px-12 md:py-12 md:pb-12 lg:px-20">
            {customer ? (
              <>
                {children}
                {/* Inside <main> so it inherits the width cap and the phone
                    bottom padding that clears the fixed tab bar. This is the
                    only route to /help, /faq, /terms and /blog now. */}
                <PortalFooter />
              </>
            ) : (
              <EmptyState
                icon={UserX}
                title={t.customer.errors.noCustomer}
                action={
                  <form action={signOut} className="mt-2">
                    <Button type="submit" variant="secondary">
                      {nav.signOut}
                    </Button>
                  </form>
                }
              />
            )}
          </main>
        </div>

        <div className="bg-sidebar border-border fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
          <PortalNav items={items} label={nav.bottomLabel} variant="bottom" />
        </div>
      </div>
    </SidebarProvider>
  )
}
