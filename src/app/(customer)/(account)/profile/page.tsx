import Image from "next/image"
import { Sparkles } from "lucide-react"

import { getMessages } from "@/lib/i18n/server"
import { getAccount } from "../account"
import { ProfileForm } from "./profile-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.profile.metaTitle }
}

export default async function ProfilePage() {
  const t = await getMessages()
  const p = t.customer.profile
  const { customer } = await getAccount()
  if (!customer) return null

  return (
    <div className="border-border bg-card grid overflow-hidden rounded-3xl border lg:grid-cols-2">
      {/* The photo half, as in the mockup. It stays visible on phones, stacked
          above the form — same treatment as `AuthSplit`. */}
      <aside className="bg-surface-low relative isolate grid min-h-[300px] content-end gap-4 p-6 md:p-12">
        {/* Decorative: the copy beside it carries the meaning. */}
        <Image
          src="/profile-hero.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="-z-10 object-cover"
        />
        {/* Only enough scrim to keep the copy legible — the mockup lets the
            photo read clearly above the text. */}
        <div
          aria-hidden
          className="from-background via-background/60 -z-10 absolute inset-0 bg-gradient-to-t to-transparent"
        />

        <div className="grid max-w-md gap-4">
          <h2 className="text-display text-primary">{p.panelTitle}</h2>
          <p className="text-body-lg text-muted-foreground">{p.panelBody}</p>
        </div>
      </aside>

      {/* The mockup puts the page title inside the form column, not above the
          card, and the order-code callout inside the form itself. */}
      <div className="grid gap-8 p-6 md:p-12">
        <div className="flex items-center gap-3">
          <Sparkles className="text-primary size-8" aria-hidden />
          <h1 className="text-headline-lg">{p.title}</h1>
        </div>
        <ProfileForm customer={customer} />
      </div>
    </div>
  )
}
