import { ArrowRight, Mail, MessageSquare, Phone } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { SectionCard } from "@/components/section-card"
import { getMessages } from "@/lib/i18n/server"
import { getAccount } from "../account"
import { HelpForm } from "./help-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.help.metaTitle }
}

export default async function HelpPage() {
  const t = await getMessages()
  const h = t.customer.help
  const { customer, email } = await getAccount()
  if (!customer) return null

  return (
    <div className="grid gap-6">
      <PageHeader title={h.title} description={h.subtitle} size="display" />

      {/* 2:1 bento, as in the mockup: the form owns two thirds and the contact
          channels stack beside it. */}
      <div className="grid gap-6 md:grid-cols-12 md:items-start">
        <SectionCard
          title={h.formTitle}
          icon={Mail}
          bodyClassName=""
          className="md:col-span-8"
        >
          <HelpForm
            defaultName={customer.full_name ?? ""}
            // The auth email is synthetic (phoneToEmail), so only a real address
            // the customer already gave us is worth pre-filling.
            defaultEmail={customer.email ?? email ?? ""}
          />
        </SectionCard>

        <div className="flex flex-col gap-6 md:col-span-4 md:h-full">
          <section className="border-border bg-card grid flex-1 content-start gap-2 rounded-2xl border p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="bg-secondary/15 text-secondary grid size-12 place-items-center rounded-full">
                <Phone className="size-5" aria-hidden />
              </span>
              <Badge variant="success">{h.hotlineBadge}</Badge>
            </div>
            <h3 className="text-headline-md">{h.hotlineTitle}</h3>
            <p className="text-body-sm text-muted-foreground">
              {h.hotlineBody}
            </p>
            <a
              href={`tel:${h.hotlineNumber.replace(/\s/g, "")}`}
              className="text-headline-md text-primary hover:underline"
            >
              {h.hotlineNumber}
            </a>
          </section>

          <section className="border-border bg-card grid flex-1 content-start gap-2 rounded-2xl border p-6">
            {/* Tertiary channel in the mockup — `--warning` is that token here. */}
            <span className="bg-warning/15 text-warning grid size-12 place-items-center rounded-full">
              <MessageSquare className="size-5" aria-hidden />
            </span>
            <h3 className="text-headline-md">{h.chatTitle}</h3>
            <p className="text-body-sm text-muted-foreground">{h.chatBody}</p>
            {/* No chat provider is wired up yet; the form below is the working
                channel, so this points back at it instead of dead-ending. */}
            <a
              href="#support-message"
              className="text-warning text-label-md inline-flex items-center gap-1.5 hover:underline"
            >
              {h.chatCta}
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </section>
        </div>
      </div>
    </div>
  )
}
