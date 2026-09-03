import Link from "next/link"
import {
  HelpCircle,
  LogOut,
  PawPrint,
  TrendingUp,
  UserRound,
  UserX,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { AccountMenu } from "@/components/account-menu"
import { EmptyState } from "@/components/empty-state"
import { PortalFooter } from "@/components/portal-footer"
import { PortalHeader } from "@/components/portal-header"
import { PortalIdentity } from "@/components/portal-identity"
import { PointsPill } from "@/components/points-pill"
import { ThemeMenuItem } from "@/components/theme-toggle"
import {
  MenuItem,
  MenuLinkItem,
  MenuSeparator,
} from "@/components/ui/menu"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getSidebarCollapsed } from "@/lib/sidebar/server"
import {
  getSpinDailyLimit,
  getSpinsUsedToday,
  getTiers,
  getUncollectedGiftCount,
  resolveDisplayTier,
} from "@/lib/loyalty"
import { signOut } from "../auth/actions"
import { type PortalNavItem, PortalNav } from "@/components/portal-nav"
import { type PortalTitle } from "@/lib/portal-title"
import {
  SidebarCta,
  SidebarProvider,
  SidebarRail,
} from "@/components/portal-sidebar"
import { SpinDialog } from "./spin/spin-dialog"
import { getAccount } from "./account"

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getMessages()
  const locale = await getLocale()
  const nav = t.customer.nav
  const { customer } = await getAccount()
  const collapsed = await getSidebarCollapsed()

  // The wheel's entry point is a header control now, not a dashboard tile, so
  // its state has to be read on EVERY route rather than once on /dashboard.
  // Same conditional-query discipline the dashboard used: nothing is read for a
  // visitor with no customer row, and nothing beyond the setting is read while
  // the admin has the wheel switched off.
  const spinLimit = customer ? await getSpinDailyLimit() : 0
  const [spinsUsed, pendingGifts] =
    customer && spinLimit > 0
      ? await Promise.all([
          getSpinsUsedToday(customer.id),
          getUncollectedGiftCount(customer.id),
        ])
      : [0, 0]
  const spinsLeft = Math.max(0, spinLimit - spinsUsed)

  // The Azure Paw mockups carry exactly four destinations, in this order, and
  // the rail and the phone bar carry the SAME four. Everything that used to be
  // a fifth or sixth rail item now has a specific home:
  //   /profile → the header's identity block (desktop) / AccountMenu (phone)
  //   /help    → PortalFooter, with /faq, /terms and /blog
  //   the wheel → a DIALOG behind the header's pill; it is not a route at all
  //   /rewards/roadmap → a sub-route of /rewards, reached from that page and
  //                      from the dashboard card; it inherits the highlight
  // If you add a fifth item here, the mockups have no pattern for it — design
  // an overflow affordance rather than letting the bar grow.
  const items: PortalNavItem[] = [
    { href: "/dashboard", label: nav.home, icon: "home" },
    { href: "/tiers", label: nav.tiers, icon: "tiers" },
    { href: "/rewards", label: nav.rewards, icon: "rewards" },
    { href: "/history", label: nav.history, icon: "history" },
  ]

  // What the header calls the section you are in. The four nav destinations
  // plus the routes that deliberately have no rail item — without them the
  // header would go blank on exactly the pages reached from the avatar. The
  // wheel is NOT among them: it is a dialog, and the page behind it keeps its
  // own name in the bar.
  const titles: PortalTitle[] = [
    ...items,
    { href: "/profile", label: nav.profile },
    { href: "/help", label: nav.help },
    // A SUB-ROUTE of /rewards, not a fifth destination: PortalNav matches by
    // prefix, so the rail and the phone bar keep "Rewards" lit, and
    // resolvePortalTitle hands the header a back chevron to the shop.
    { href: "/rewards/roadmap", label: nav.roadmap },
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
        {/* Desktop rail. Its bottom carries the upgrade CTA and nothing else:
            who you are moved up to the header, where a reader looks for their
            own account, and the theme switch and sign-out went with it into the
            menu behind the avatar. Below `md` there is no rail at all, so the
            CTA joins them in AccountMenu. */}
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
              /* Pinned to the very bottom of the rail, as in the mockups —
                 now the only thing down there. Below `md` there is no rail, so
                 AccountMenu carries the same row. */
              <SidebarCta
                href="/tiers"
                label={nav.upgradeCta}
                icon={<TrendingUp className="size-5" aria-hidden />}
              />
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
                  {/* The wheel. A dashboard tile, then a route, now a dialog
                      behind this pill: one control away from every screen, and
                      styled to match the points pill beside it so the pair
                      reads as one group. The component owns the trigger — see
                      spin/spin-dialog.tsx for why nothing is read until it
                      opens. */}
                  {spinLimit > 0 && (
                    <SpinDialog
                      spinsLeft={spinsLeft}
                      pendingGifts={pendingGifts}
                    />
                  )}

                  <PointsPill
                    value={customer.current_points}
                    unit={nav.pointsUnit}
                    locale={locale}
                  />
                </>
              )
            }
            system={
              customer && (
                <>
                  {/* Who you are, from `md` up — and, behind it, the theme
                      switch and sign-out that used to sit beside it as loose
                      icons. "Nâng hạng" is NOT repeated here: on desktop the
                      rail pins it, in view the whole time. */}
                  <PortalIdentity
                    className="max-md:hidden"
                    label={nav.avatarLabel}
                    name={customer.full_name ?? customer.phone}
                    caption={tierName}
                    captionClassName="text-primary"
                  >
                    {/* The children go INSIDE the Link: Radix's Slot will not
                        merge a slot's own children into a child that already
                        has some. */}
                    <MenuLinkItem>
                      <Link href="/profile">
                        <UserRound className="size-5" aria-hidden />
                        {nav.profile}
                      </Link>
                    </MenuLinkItem>
                    <MenuLinkItem>
                      <Link href="/help">
                        <HelpCircle className="size-5" aria-hidden />
                        {nav.help}
                      </Link>
                    </MenuLinkItem>

                    <MenuSeparator />

                    <ThemeMenuItem />

                    <form action={signOut}>
                      {/* Deliberately not `text-destructive`: signing out
                          destroys nothing, and the red read as an error.
                          `closeOnClick={false}` so the popup does not unmount
                          the form out from under its own submit. */}
                      <MenuItem closeOnClick={false} asChild>
                        <button type="submit">
                          <LogOut className="size-5" aria-hidden />
                          {nav.signOut}
                        </button>
                      </MenuItem>
                    </form>
                  </PortalIdentity>

                  {/* Phone only — the same rows, in a bottom sheet. */}
                  <AccountMenu
                    name={customer.full_name ?? customer.phone}
                    className="md:hidden"
                  />
                </>
              )
            }
          />

          {/* The bottom pad clears the phone tab bar, its floating active bubble
              and the home indicator below it. */}
          <main className="mx-auto w-full max-w-[1280px] grow px-4 py-6 pb-[calc(--spacing(32)+env(safe-area-inset-bottom))] md:px-6 md:py-12 md:pb-12 lg:px-8">
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

        <div className="bg-sidebar border-border/60 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
          <PortalNav items={items} label={nav.bottomLabel} variant="bottom" />
        </div>
      </div>
    </SidebarProvider>
  )
}
