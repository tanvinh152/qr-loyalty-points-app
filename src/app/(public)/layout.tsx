import Link from "next/link"

import { PortalFooter } from "@/components/portal-footer"
import { ThemeToggle } from "@/components/theme-toggle"
import { getMessages } from "@/lib/i18n/server"
import { createClient } from "@/lib/supabase/server"

// Public shell for /blog, /faq and /terms — no session required. It deliberately
// does NOT reuse the account or admin layouts, which both assume a signed-in
// user (points pill, avatar, sign-out) these routes never have.
//
// These routes are intentionally absent from ACCOUNT_PREFIXES in
// src/lib/supabase/middleware.ts: /register links to /terms, so gating it would
// bounce an anonymous signer-up to /login.
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getMessages()

  // The brand link has to lead somewhere useful for both kinds of visitor: a
  // member who arrived from the account footer, and a stranger reading /terms
  // before signing up.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const home = user ? "/dashboard" : "/login"

  return (
    <div className="bg-canvas min-h-svh">
      <header className="bg-sidebar border-border sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={home} className="text-headline-md text-primary">
            {t.brand.name}
          </Link>
          <ThemeToggle iconOnly />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:py-12">
        {children}
        <PortalFooter />
      </main>
    </div>
  )
}
