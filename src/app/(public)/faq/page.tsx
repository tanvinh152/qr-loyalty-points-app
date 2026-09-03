import Link from "next/link"
import { LifeBuoy } from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { buttonVariants } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages()
  return { title: t.faq.metaTitle }
}

// The disclosures are ui/accordion (Animate UI over Radix), which replaced a
// native <details>/<summary>. That native version needed no client boundary and
// worked with JS off; the accordion buys an animated reveal and a real
// aria-expanded/aria-controls pairing. This page ITSELF stays a server
// component — only the Accordion subtree crosses the boundary, and the
// questions and answers are static i18n strings passed straight through.
//
// `collapsible` so the open item can be closed again, and `type="single"` so a
// group reads as one list of questions rather than an expandable wall.
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
          <Accordion type="single" collapsible className="grid gap-2">
            {group.items.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
