import Link from "next/link"

import { getMessages } from "@/lib/i18n/server"

// The four links the Azure Paw mockups put in a page footer. This is the only
// route to /help, /faq, /terms and /blog now that the main nav is the mockups'
// four items (dashboard / tiers / rewards / history), so it is load-bearing
// navigation rather than decoration — do not drop it from a shell.
//
// Rendered inside the account shell's <main> so it inherits the max width and,
// on a phone, the bottom padding that clears the fixed tab bar.
export async function PortalFooter() {
  const t = await getMessages()
  const f = t.footer

  const links = [
    { href: "/help", label: f.help },
    { href: "/faq", label: f.faq },
    { href: "/terms", label: f.terms },
    { href: "/blog", label: f.blog },
  ]

  return (
    // A filled, rounded bar rather than a hairline rule: that is how the Azure
    // Paw mockups close every page.
    <footer className="bg-surface-container text-body-sm text-muted-foreground mt-12 flex flex-col items-center gap-4 rounded-3xl px-6 py-8 sm:flex-row sm:justify-between">
      <p>{f.copyright(new Date().getFullYear())}</p>
      <nav aria-label={f.label}>
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  )
}
