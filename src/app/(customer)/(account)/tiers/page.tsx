import {
  Award,
  Cake,
  Gift,
  Lock,
  Medal,
  Percent,
  Sparkles,
  Truck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getTiers, tierProgress } from "@/lib/loyalty"
import type { PerkIconKey } from "@/lib/tier-perks"
import { getAccount } from "../account"
import { tierAccentClass, tierRank } from "../tier-accent"
import { MemberCardDialog } from "./member-card-dialog"
import { TierRing } from "./tier-ring"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.tiers.metaTitle }
}

/** Perks repeated inside the hero, as in the member mockups. */
const HERO_PERKS = 3

// `perks[].icon` is a string in the DB, so it cannot be a component reference.
// Unknown keys fall back rather than crashing the page on an admin typo. The
// key vocabulary the admin editor offers lives in `src/lib/tier-perks.ts`.
const PERK_ICONS: Record<PerkIconKey, LucideIcon> = {
  percent: Percent,
  gift: Gift,
  truck: Truck,
  cake: Cake,
  award: Award,
  sparkles: Sparkles,
}

export default async function TiersPage() {
  const t = await getMessages()
  const ti = t.customer.tiers
  const { customer } = await getAccount()
  if (!customer) return null

  // Sorted by threshold, so the array index is the tier's rank.
  const tiers = await getTiers()
  const {
    current,
    next,
    percent: progress,
    toNext,
  } = tierProgress(tiers, customer.lifetime_points)

  const rank = tierRank(tiers, current?.id)
  const perks = current?.perks ?? []
  const heroPerks = perks.slice(0, HERO_PERKS)

  const locale = await getLocale()
  const memberSince = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    { month: "long", year: "numeric" },
  ).format(new Date(customer.created_at))
  // The card is a screen the member shows in a shop, so the number stays masked
  // the same way Pancake masks it.
  const maskedPhone = customer.phone.replace(/^(\d{2})\d+(\d{2})$/, "$1••••$2")

  return (
    <div className={cn("grid gap-6", tierAccentClass(rank))}>
      <PageHeader
        title={current ? ti.title(current.name) : ti.noTier}
        description={ti.subtitle}
        size="display"
        eyebrow={
          <span className="text-label-md text-tier border-tier/40 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 uppercase">
            <Medal className="size-3.5" aria-hidden />
            {ti.eyebrow}
          </span>
        }
      />

      {!current ? (
        <div className="border-border bg-card rounded-2xl border">
          <EmptyState
            icon={Medal}
            title={ti.noTier}
            description={ti.noTierBody}
          />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-12">
          <section className="border-border bg-card relative min-h-[400px] overflow-hidden rounded-3xl border p-6 md:col-span-8 md:p-12">
            {/* Decorative gem glow — the accent class set --tier above. */}
            <span
              aria-hidden
              className="bg-tier/20 pointer-events-none absolute -top-16 -right-16 size-56 rounded-full blur-3xl"
            />
            <div className="relative grid gap-6">
              <div className="flex items-start gap-4">
                <span className="border-tier/40 bg-tier/10 text-tier grid size-20 shrink-0 place-items-center rounded-full border">
                  <Medal className="size-9" aria-hidden />
                </span>
                <div className="grid gap-1">
                  <span className="text-label-md text-tier uppercase">
                    {ti.statusActive(current.name)}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-headline-lg text-primary tabular-nums">
                      {customer.lifetime_points.toLocaleString()}
                    </span>
                    <span className="text-body-lg text-muted-foreground">
                      {t.customer.dashboard.lifetimeLabel}
                    </span>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {ti.multiplier(current.multiplier)}
                  </Badge>
                </div>
              </div>

              {/* The hero repeats the top perks so the tier's value reads without
                  scrolling to the grid below. */}
              {heroPerks.length > 0 && (
                <div className="grid gap-3">
                  <span className="text-label-md text-muted-foreground uppercase">
                    {ti.heroPerksLabel}
                  </span>
                  <ul className="grid gap-2">
                    {heroPerks.map((perk, index) => {
                      const Icon =
                        PERK_ICONS[perk.icon as PerkIconKey] ?? Sparkles
                      return (
                        <li
                          key={`${perk.title}-${index}`}
                          className="flex items-center gap-3"
                        >
                          <span className="border-tier/40 text-tier grid size-9 shrink-0 place-items-center rounded-full border">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="text-body-sm">{perk.title}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <MemberCardDialog
                name={customer.full_name ?? customer.phone}
                tierName={current.name}
                points={customer.lifetime_points}
                memberSince={memberSince}
                phone={maskedPhone}
              />
            </div>
          </section>

          <section className="border-border bg-card grid content-center justify-items-center gap-4 rounded-3xl border p-6 text-center md:col-span-4 md:p-8">
            <h2 className="text-headline-md">{ti.progressTitle}</h2>
            {next ? (
              <>
                <TierRing
                  percent={progress}
                  label={ti.levelLabel(rank != null ? rank + 1 : 1)}
                  caption={current.name}
                />
                <p className="text-body-sm text-muted-foreground">
                  {ti.toNext(toNext, next.name)}
                </p>
              </>
            ) : (
              <>
                <TierRing
                  percent={100}
                  label={ti.maxLabel}
                  caption={ti.maxLevel}
                />
                <p className="text-body-sm text-muted-foreground">
                  {ti.atTop(current.name)}
                </p>
              </>
            )}
          </section>
        </div>
      )}

      {current && (
        // Not a SectionCard: the mockup's privileges panel carries a full-height
        // tier rail down its left edge, which the shared header strip has no
        // room for.
        <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-6 md:p-8">
          <span aria-hidden className="bg-tier absolute inset-y-0 left-0 w-1" />
          <h2 className="text-headline-md mb-6">
            {ti.perksTitle(current.name)}
          </h2>
          {perks.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">{ti.noPerks}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {perks.map((perk, index) => {
                const Icon = PERK_ICONS[perk.icon as PerkIconKey] ?? Sparkles
                return (
                  <li
                    key={`${perk.title}-${index}`}
                    className="border-border bg-surface-container flex gap-3 rounded-2xl border p-4"
                  >
                    <span className="border-tier/40 bg-tier/10 text-tier grid size-10 shrink-0 place-items-center rounded-full border">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="grid gap-0.5">
                      <span className="text-body-lg font-semibold">
                        {perk.title}
                      </span>
                      {perk.detail && (
                        <span className="text-body-sm text-muted-foreground">
                          {perk.detail}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <section className="grid gap-4">
        <h2 className="text-label-sm text-muted-foreground tracking-[0.2em] uppercase">
          {ti.othersTitle}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <li
              key={tier.id}
              className={cn(
                "border-border grid gap-1 rounded-3xl border p-6",
                tierAccentClass(index),
                tier.id === current?.id && "border-tier ring-tier ring-1",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="border-tier/40 text-tier grid size-10 shrink-0 place-items-center rounded-full border">
                  <Medal className="size-5" aria-hidden />
                </span>
                <span className="text-headline-md">{tier.name}</span>
              </div>
              <span className="text-body-sm text-muted-foreground">
                {ti.multiplier(tier.multiplier)}
              </span>
              <span className="text-body-xs text-muted-foreground tabular-nums">
                {ti.thresholdAt(tier.threshold)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Teaser for the invite-only rank in the mockups. There is no such row in
          membership_tiers yet, so it is deliberately static and inert. */}
      <section className="border-border bg-surface-container flex items-center gap-4 rounded-3xl border border-dashed p-6">
        <span className="bg-surface-high text-muted-foreground grid size-12 shrink-0 place-items-center rounded-full">
          <Lock className="size-5" aria-hidden />
        </span>
        <div className="grid gap-0.5">
          <span className="text-body-lg font-semibold">{ti.lockedTitle}</span>
          <span className="text-body-sm text-muted-foreground">
            {ti.lockedBody}
          </span>
        </div>
      </section>
    </div>
  )
}
