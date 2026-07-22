import Link from "next/link"
import { CircleHelp, Timer, UserRoundPen } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/server"
import { ClaimForm } from "./claim-form"
import { getAccount } from "../account"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.claim.metaTitle }
}

export default async function ClaimPage({
  searchParams,
}: {
  // `/profile` sends the code the customer typed in its callout over as `?code=`
  // so they don't have to retype it here.
  searchParams: Promise<{ code?: string | string[] }>
}) {
  const { code } = await searchParams
  const defaultOrderCode = (Array.isArray(code) ? code[0] : code) ?? ""
  const t = await getMessages()
  const hero = t.claim.hero
  const help = t.claim.help
  const hint = t.claim.profileHint

  const { customer } = await getAccount()
  // The layout renders the "no points account" notice in this case.
  if (!customer) return null

  const cards = [
    { icon: Timer, title: help.instantTitle, body: help.instantBody },
    { icon: CircleHelp, title: help.supportTitle, body: help.supportBody },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader title={hero.title} description={hero.subtitle} />

      {/* The claim itself never asks for a name — the RPC keeps whatever the
          customer row already has — so a missing one is a nudge, not a block. */}
      {!customer.full_name && (
        <div className="bg-surface-container border-border flex flex-col gap-3 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <p className="text-body-lg flex items-center gap-2 font-semibold">
              <UserRoundPen className="text-primary size-5" aria-hidden />
              {hint.title}
            </p>
            <p className="text-body-sm text-muted-foreground">{hint.body}</p>
          </div>
          <Link
            href="/profile"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {hint.cta}
          </Link>
        </div>
      )}

      <ClaimForm defaultOrderCode={defaultOrderCode} />

      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((c) => (
          <div
            key={c.title}
            className="bg-card border-border flex items-start gap-4 rounded-xl border p-6"
          >
            <span className="bg-surface-high text-primary grid size-11 shrink-0 place-items-center rounded-full">
              <c.icon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold">{c.title}</h2>
              <p className="text-body-sm text-muted-foreground">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
