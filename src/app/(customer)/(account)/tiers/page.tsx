import { Award, Cake, Gem, Gift, Percent, Sparkles, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { cn, formatVnd } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getLatestTierAward, getTiers, tierProgress } from "@/lib/loyalty"
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

  // Sorted by spend threshold, so the array index is the tier's rank.
  const tiers = await getTiers()
  const {
    current,
    next,
    percent: progress,
    toNext,
  } = tierProgress(tiers, customer.lifetime_spend, customer)

  // Only when the tier they hold now costs more than they have spent — i.e. the
  // requirement moved after they earned it. Saying so is the difference between
  // "kept for good" and looking like a bug.
  const grandfathered =
    current && current.spend_threshold > customer.lifetime_spend
      ? await getLatestTierAward(customer.id, current.id)
      : null

  const rank = tierRank(tiers, current?.id)
  const perks = current?.perks ?? []
  const heroPerks = perks.slice(0, HERO_PERKS)

  const locale = await getLocale()
  const monthYear = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    {
      month: "long",
      year: "numeric",
    },
  )
  const memberSince = monthYear.format(new Date(customer.created_at))
  // The card is a screen the member shows in a shop, so the number stays masked
  // the same way Pancake masks it.
  const maskedPhone = customer.phone.replace(/^(\d{2})\d+(\d{2})$/, "$1••••$2")

  return (
    <div
      className={cn(
        "grid gap-4 rounded-3xl p-4 sm:gap-6 sm:p-6 md:p-10",
        tierAccentClass(rank),
      )}
    >
      <PageHeader
        title={current ? ti.title(current.name) : ti.noTier}
        description={ti.subtitle}
        size="display"
        eyebrow={
          <span className="text-label-md text-tier border-tier/40 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 uppercase">
            <Gem className="size-3.5" aria-hidden />
            {ti.eyebrow}
          </span>
        }
      />

      {!current ? (
        <div className="border-border bg-card rounded-2xl border">
          <EmptyState
            icon={Gem}
            title={ti.noTier}
            description={ti.noTierBody}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-12">
          <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-4 sm:min-h-[400px] sm:p-6 md:col-span-8 md:p-12">
            {/* Decorative gem glow — the accent class set --tier above. */}
            <span
              aria-hidden
              className="bg-tier/20 pointer-events-none absolute -top-16 -right-16 size-56 rounded-full blur-3xl"
            />
            <div className="relative grid gap-4 sm:gap-6">
              {/* Status text leads on the left; the gem emblem sits top-right
                  with its own glow, as in the member mockups. */}
              <div className="flex items-start justify-between gap-4">
                <div className="grid min-w-0 gap-1">
                  <span className="text-label-md text-tier uppercase">
                    {ti.statusActive(current.name)}
                  </span>
                  {/* Spend leads here: it is what the ring below fills with and
                      what the other tiers are priced in. */}
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-headline-lg text-primary tabular-nums">
                      {formatVnd(customer.lifetime_spend)}
                    </span>
                    <span className="text-body-lg text-muted-foreground">
                      {ti.spendLabel}
                    </span>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {ti.multiplier(current.multiplier)}
                  </Badge>
                  {grandfathered && (
                    <p className="text-body-sm text-muted-foreground">
                      {ti.grandfathered(
                        current.name,
                        monthYear.format(new Date(grandfathered.awarded_at)),
                      )}
                    </p>
                  )}
                </div>
                <span className="border-tier/30 bg-tier/10 text-tier shadow-tier/30 grid size-14 shrink-0 place-items-center rounded-2xl border shadow-[0_0_30px_-6px] sm:size-20">
                  <Gem className="size-7 sm:size-9" aria-hidden />
                </span>
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
                          <span className="border-tier/30 bg-tier/10 text-tier grid size-9 shrink-0 place-items-center rounded-xl border">
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

          <section className="border-border bg-card grid content-center justify-items-center gap-4 rounded-3xl border p-4 text-center sm:p-6 md:col-span-4 md:p-8">
            <h2 className="text-headline-md">{ti.progressTitle}</h2>
            {next ? (
              <>
                <TierRing
                  percent={progress}
                  label={ti.levelLabel(rank != null ? rank + 1 : 1)}
                  caption={current.name}
                />
                <p className="text-body-sm text-muted-foreground">
                  {ti.spendToNext(formatVnd(toNext), next.name)}
                </p>
              </>
            ) : (
              <>
                {/* Same caption as the other branch — the tier's own name.
                    A bare "Level" under MAX says nothing. */}
                <TierRing
                  percent={100}
                  label={ti.maxLabel}
                  caption={current.name}
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
        <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-4 sm:p-6 md:p-8">
          <span aria-hidden className="bg-tier absolute inset-y-0 left-0 w-1" />
          <h2 className="text-headline-md mb-4 sm:mb-6">
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
                    <span className="border-tier/30 bg-tier/10 text-tier grid size-10 shrink-0 place-items-center rounded-xl border">
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
                "border-border grid gap-1 rounded-3xl border p-4 sm:p-6",
                tierAccentClass(index),
                tier.id === current?.id && "border-tier ring-tier ring-1",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="border-tier/30 bg-tier/10 text-tier grid size-10 shrink-0 place-items-center rounded-xl border">
                  <Gem className="size-5" aria-hidden />
                </span>
                <span className="text-headline-md">{tier.name}</span>
              </div>
              <span className="text-body-sm text-muted-foreground">
                {ti.multiplier(tier.multiplier)}
              </span>
              <span className="text-body-xs text-muted-foreground tabular-nums">
                {ti.thresholdAt(formatVnd(tier.spend_threshold))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
