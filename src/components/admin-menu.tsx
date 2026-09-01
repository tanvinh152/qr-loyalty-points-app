"use client"

import Link from "next/link"
import { Gift, LogOut, Medal, Newspaper, Settings } from "lucide-react"

import { MENU_ROW, PortalMenu } from "@/components/portal-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { logout } from "@/app/admin/login/actions"
import { useT } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

// Admin's rows inside the shared phone sheet. The phone tab bar carries four
// sections; these are the ones it cannot, and they used to be a row of unlabelled
// icons wedged under the header — reachable, but only if you already knew what
// each glyph meant.

export function AdminMenu({
  email,
  className,
}: {
  email: string
  className?: string
}) {
  const nav = useT().admin.nav

  const rows = [
    { href: "/admin/tiers", label: nav.tiers, icon: Medal },
    { href: "/admin/rewards", label: nav.rewards, icon: Gift },
    { href: "/admin/blog", label: nav.blog, icon: Newspaper },
    { href: "/admin/settings", label: nav.settings, icon: Settings },
  ]

  return (
    <PortalMenu
      name={email}
      avatarLabel={nav.accountLabel}
      title={nav.menuTitle}
      className={className}
    >
      {(close) => (
        <>
          {rows.map((row) => (
            <Link
              key={row.href}
              href={row.href}
              onClick={close}
              className={MENU_ROW}
            >
              <row.icon className="size-5" aria-hidden />
              {row.label}
            </Link>
          ))}

          <ThemeToggle
            className={cn(MENU_ROW, "h-auto justify-start font-normal")}
          />

          <form action={logout}>
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
