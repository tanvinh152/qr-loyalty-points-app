import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"
import { getMessages } from "@/lib/i18n/server"

// Public site — no session, no portal-nav shell. Its own minimal header
// rather than reusing the admin/customer layouts, which both assume a signed
// -in user (brand link, sign-out, avatar) this route never has.
export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getMessages()

  return (
    <div className="min-h-svh">
      <header className="bg-sidebar border-border sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/blog" className="text-headline-md text-primary">
            {t.meta.appTitle}
          </Link>
          <ThemeToggle iconOnly />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:py-12">
        {children}
      </main>
    </div>
  )
}
