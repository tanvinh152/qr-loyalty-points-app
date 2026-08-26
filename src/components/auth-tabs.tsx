import Link from "next/link"

import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/server"

/**
 * The Đăng nhập / Đăng ký strip at the top of the auth card.
 *
 * Two `<Link>`s, not a client tab control: `/login` and `/register` are separate
 * routes with separate server actions and separate metadata, and collapsing them
 * into one tabbed page would delete two URLs that are already linked from
 * elsewhere. The mockup's tab strip is a look, not a routing decision.
 */
export async function AuthTabs({ active }: { active: "login" | "register" }) {
  const t = await getMessages()

  const tabs = [
    { href: "/login", label: t.customer.login.tabLogin, key: "login" },
    { href: "/register", label: t.customer.login.tabRegister, key: "register" },
  ] as const

  return (
    <nav className="border-border mb-6 flex border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "text-headline-md flex-1 pb-3 text-center transition-colors",
            tab.key === active
              ? "border-primary text-primary border-b-2"
              : "text-muted-foreground hover:text-primary",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
