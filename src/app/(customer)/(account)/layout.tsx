import Link from "next/link"
import {
  HelpCircle,
  History,
  LogOut,
  Medal,
  PawPrint,
  Sparkles,
  UserRound,
  UserX,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/server"
import { getTiers, resolveTiers } from "@/lib/loyalty"
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

  const items: PortalNavItem[] = [
    { href: "/dashboard", label: nav.home, icon: "home" },
    { href: "/claim", label: nav.scan, icon: "scan" },
    { href: "/rewards", label: nav.rewards, icon: "rewards" },
    { href: "/tiers", label: nav.tiers, icon: "tiers" },
    { href: "/history", label: nav.history, icon: "history" },
    { href: "/help", label: nav.help, icon: "help" },
  ]

  // The mockups' phone bar carries four destinations; it keeps the rail's three
  // most used ones and adds Profile, which has no other home on a phone.
  const bottomItems: PortalNavItem[] = [
    { href: "/dashboard", label: nav.home, icon: "home" },
    { href: "/rewards", label: nav.rewards, icon: "rewards" },
    { href: "/tiers", label: nav.tiers, icon: "tiers" },
    { href: "/profile", label: nav.profile, icon: "profile" },
  ]

  // The rail's brand block shows the tier, not the balance — the balance already
  // leads the dashboard and the phone header.
  const tierName = customer
    ? (resolveTiers(await getTiers(), customer.lifetime_points).current?.name ??
      null)
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
    <div className="bg-surface-low flex min-h-svh">
      {/* Desktop rail. Fixed width, own scroll, brand at the top and the
          upgrade/sign-out pair pinned to the bottom. */}
      <aside className="bg-sidebar border-border sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r p-4 md:flex">
        <Link
          href="/dashboard"
          className="mb-8 flex items-center gap-3 px-2 py-2"
        >
          <span className="bg-primary-container grid size-9 place-items-center rounded-xl">
            <PawPrint className="text-primary-foreground size-5" aria-hidden />
          </span>
          <span className="grid">
            <span className="text-headline-md text-foreground leading-tight">
              {t.claim.brand.name}
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
          <Link
            href="/tiers"
            className={cn(buttonVariants({ variant: "default" }), "w-full")}
          >
            <Sparkles className="size-4" aria-hidden />
            {nav.upgrade}
          </Link>
          {/* Profile sits outside PortalNav: it is account settings, not one of
              the five primary destinations, and the phone tab bar has no room. */}
          <Link
            href="/profile"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-full justify-start",
            )}
          >
            <UserRound className="size-4" aria-hidden />
            {nav.profile}
          </Link>
          {signOutButton}
        </div>
      </aside>

      <div className="flex min-w-0 grow flex-col">
        {/* Phone header: the rail is hidden there, so the brand and balance
            still need a home. */}
        <header className="bg-sidebar border-border sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <PawPrint className="text-primary size-5" aria-hidden />
            <span className="text-headline-md">{t.claim.brand.name}</span>
          </Link>
          {customer && (
            <span className="bg-surface-high text-label-md text-primary ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <Sparkles className="size-4" aria-hidden />
              {customer.current_points.toLocaleString()} {nav.pointsUnit}
            </span>
          )}
          {/* Profile moved into the phone tab bar, so the header carries the two
              destinations the bar had to drop. */}
          <Link
            href="/history"
            aria-label={nav.history}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              !customer && "ml-auto",
            )}
          >
            <History className="size-5" aria-hidden />
          </Link>
          <Link
            href="/help"
            aria-label={nav.help}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <HelpCircle className="size-5" aria-hidden />
          </Link>
        </header>

        {/* pb-24 keeps the last row clear of the phone tab bar. */}
        <main className="mx-auto w-full max-w-[1280px] grow px-4 py-6 pb-28 md:px-12 md:py-12 md:pb-12 lg:px-20">
          {customer ? (
            children
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
