"use client"

import Link from "next/link"
import { HelpCircle, LogOut, TrendingUp, UserRound } from "lucide-react"

import { MENU_ROW, PortalMenu } from "@/components/portal-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { signOut } from "@/app/(customer)/auth/actions"
import { useT } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

// The member portal's rows inside the shared phone sheet. From `md` up the
// header has room for the upgrade CTA, the theme switch and sign-out as their
// own controls, and the rail's footer carries the member; below `md` none of
// that fits, so it all lives behind the avatar.
//
// `signOut` is a server action imported straight into a client component, which
// is allowed: `<form action={signOut}>` posts to it the same way the layout's
// own form does.

export function AccountMenu({
  name,
  className,
}: {
  /** Whatever the header shows the member as — full name, or phone. */
  name: string
  className?: string
}) {
  const nav = useT().customer.nav

  return (
    <PortalMenu
      name={name}
      avatarLabel={nav.avatarLabel}
      title={nav.accountMenuTitle}
      className={className}
    >
      {(close) => (
        <>
          <Link href="/tiers" onClick={close} className={MENU_ROW}>
            <TrendingUp className="size-5" aria-hidden />
            {nav.upgradeCta}
          </Link>
          <Link href="/profile" onClick={close} className={MENU_ROW}>
            <UserRound className="size-5" aria-hidden />
            {nav.profile}
          </Link>
          <Link href="/help" onClick={close} className={MENU_ROW}>
            <HelpCircle className="size-5" aria-hidden />
            {nav.help}
          </Link>

          <ThemeToggle
            className={cn(MENU_ROW, "h-auto justify-start font-normal")}
          />

          <form action={signOut}>
            {/* Not `text-destructive`: signing out destroys nothing, and the
                red read as an error state sitting in the chrome. */}
            <button type="submit" className={MENU_ROW}>
              <LogOut className="size-5" aria-hidden />
              {nav.signOut}
            </button>
          </form>
        </>
      )}
    </PortalMenu>
  )
}
