import Link from "next/link"
import { LogOut, Medal, PawPrint, Sparkles, TrendingUp, UserX } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { InitialsAvatar } from "@/components/initials-avatar"
import { PortalFooter } from "@/components/portal-footer"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/server"
import { getTiers, resolveDisplayTier } from "@/lib/loyalty"
import { signOut } from "../auth/actions"
import { PortalNav, type PortalNavItem } from "@/components/portal-nav"
import { getAccount } from "./account"

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getMessages()
  const nav = t.customer.nav
  const { customer } = await getAccount()

  // The Vibrant Paw mockups carry exactly four destinations, in this order, and
  // the rail and the phone bar carry the SAME four. Everything that used to be
  // a fifth or sixth rail item now has a specific home:
  //   /profile → the avatar in the header (both widths)
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

  // The rail's brand block shows the tier, not the balance — the balance already
  // leads the dashboard and the phone header.
  // The display tier, not the one the spend earns: a member kept on an old
  // threshold must never see the rail quietly demote them.
  const tierName = customer
    ? (resolveDisplayTier(await getTiers(), customer)?.name ?? null)
    : null

  const signOutButton = (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="w-full justify-start"
      >
        <LogOut className="size-4" aria-hidden />
        {nav.signOut}
      </Button>
    </form>
  )

  return (
    <div className="bg-canvas flex min-h-svh">
      {/* Desktop rail. Fixed width, own scroll, brand at the top and the
          upgrade/sign-out pair pinned to the bottom. */}
      <aside className="bg-sidebar border-border shadow-nav sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r p-4 md:flex">
        <Link
          href="/dashboard"
          className="mb-8 flex items-center gap-3 px-2 py-2"
        >
          <span className="bg-primary-container grid size-9 place-items-center rounded-xl">
            <PawPrint className="text-primary-foreground size-5" aria-hidden />
          </span>
          <span className="grid">
            <span className="text-headline-md text-foreground leading-tight">
              {t.brand.name}
            </span>
            {tierName && (
              <span className="text-label-md text-primary inline-flex items-center gap-1 uppercase">
                <Medal className="size-3.5" aria-hidden />
                {tierName}
              </span>
            )}
          </span>
        </Link>

        <PortalNav items={items} label={nav.mainLabel} variant="rail" />

        <div className="mt-auto grid gap-1 pt-4">
          {/* The mockups' rail CTA. */}
          <Link
            href="/tiers"
            className={cn(
              buttonVariants({ variant: "muted" }),
              "w-full justify-start",
            )}
          >
            <TrendingUp className="size-4" aria-hidden />
            {nav.upgradeCta}
          </Link>
          {/* Deliberately kept, though the mockups have no sign-out anywhere:
              dropping it would leave a desktop member no way out except
              navigating to /profile. */}
          {signOutButton}
        </div>
      </aside>

      <div className="flex min-w-0 grow flex-col">
        {/* Header at EVERY width now, because the avatar is the only route to
            /profile and the theme switch left the rail with it. The brand block
            stays phone-only — from md up the rail carries it. */}
        <header className="bg-sidebar border-border sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b px-4 pt-[env(safe-area-inset-top)] md:px-12 lg:px-20">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2 md:hidden"
          >
            <PawPrint className="text-primary size-5 shrink-0" aria-hidden />
            <span className="text-headline-md truncate">{t.brand.name}</span>
          </Link>
          {customer && (
            <span className="bg-surface-high text-label-md text-primary ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 whitespace-nowrap">
              <Sparkles className="size-4" aria-hidden />
              {customer.current_points.toLocaleString()} {nav.pointsUnit}
            </span>
          )}
          <ThemeToggle iconOnly />
          {customer && (
            <Link
              href="/profile"
              aria-label={nav.avatarLabel}
              className="shrink-0 rounded-full"
            >
              <InitialsAvatar name={customer.full_name ?? customer.phone} />
            </Link>
          )}
        </header>

        {/* The bottom pad clears the phone tab bar, its floating active bubble
            and the home indicator below it. */}
        <main className="mx-auto w-full max-w-[1280px] grow px-4 py-6 pb-[calc(--spacing(32)+env(safe-area-inset-bottom))] md:px-12 md:py-12 md:pb-12 lg:px-20">
          {customer ? (
            <>
              {children}
              {/* Inside <main> so it inherits the width cap and the phone bottom
                  padding that clears the fixed tab bar. This is the only route
                  to /help, /faq, /terms and /blog now. */}
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
        <PortalNav
          items={items}
          label={nav.bottomLabel}
          variant="bottom"
        />
      </div>
    </div>
  )
}
