import Link from "next/link"
import { LifeBuoy } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages()
  return { title: t.faq.metaTitle }
}

// Native <details> rather than the Collapsible primitive: it needs no client
// boundary, is keyboard-accessible for free, and works with JS disabled. The
// answers are static i18n strings, so there is nothing to hydrate.
export default async function FaqPage() {
  const t = await getMessages()
  const f = t.faq

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-headline-lg">{f.title}</h1>
        <p className="text-muted-foreground">{f.subtitle}</p>
      </header>

      {f.groups.map((group) => (
        <section key={group.title} className="grid gap-3">
          <h2 className="text-label-md text-muted-foreground tracking-[0.2em] uppercase">
            {group.title}
          </h2>
          <div className="grid gap-2">
            {group.items.map((item) => (
              <details
                key={item.q}
                className="border-border bg-card shadow-soft group rounded-3xl border px-5 py-4"
              >
                <summary className="text-body-lg marker:content-none flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {item.q}
                  <span
                    aria-hidden
                    className="text-primary shrink-0 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground mt-3">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <section className="border-border bg-surface-container grid gap-3 rounded-3xl border p-6 text-center">
        <LifeBuoy className="text-primary mx-auto size-6" aria-hidden />
        <h2 className="text-headline-md">{f.stillStuckTitle}</h2>
        <p className="text-muted-foreground">{f.stillStuckBody}</p>
        <Link
          href="/help"
          className={cn(buttonVariants({ size: "lg" }), "mx-auto mt-2")}
        >
          {f.stillStuckCta}
        </Link>
      </section>
    </div>
  )
}
