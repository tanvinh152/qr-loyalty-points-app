import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { Button } from "@/components/ui/button"
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

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="font-semibold">
              {nav.brand}
            </Link>
            <Link href="/admin/settings" className="text-muted-foreground hover:text-foreground">
              {nav.settings}
            </Link>
            <Link href="/admin/tiers" className="text-muted-foreground hover:text-foreground">
              {nav.tiers}
            </Link>
            <Link href="/admin/products" className="text-muted-foreground hover:text-foreground">
              {nav.products}
            </Link>
            <Link href="/admin/rewards" className="text-muted-foreground hover:text-foreground">
              {nav.rewards}
            </Link>
            <Link href="/admin/customers" className="text-muted-foreground hover:text-foreground">
              {nav.customers}
            </Link>
            <Link href="/admin/transactions" className="text-muted-foreground hover:text-foreground">
              {nav.transactions}
            </Link>
          </nav>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              {nav.signOut}
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
