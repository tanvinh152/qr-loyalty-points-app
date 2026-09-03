import {
  Award,
  Cake,
  CalendarClock,
  CheckCircle,
  FerrisWheel,
  FlaskConical,
  Gem,
  Gift,
  Heart,
  Layers,
  PawPrint,
  Percent,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { cn, formatVnd } from "@/lib/utils"
import { ENTER, STAGGER } from "@/lib/motion/tokens"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getLatestTierAward, getTiers, tierProgress } from "@/lib/loyalty"
import type { MembershipTierRow } from "@/lib/db-types"
import type { PerkIconKey } from "@/lib/tier-perks"
import { getAccount } from "../account"
import { tierAccentClass, tierRank } from "../tier-accent"
import { MemberCardDialog } from "./member-card-dialog"
import { TierRing } from "./tier-ring"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.tiers.metaTitle }
}

/** Perks named in the ladder table's third column. The rest live in the panel. */
const TABLE_PERKS = 2

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
  wheel: FerrisWheel,
  paw: PawPrint,
  flask: FlaskConical,
  layers: Layers,
  heart: Heart,
}

/**
 * The two headline benefits shown against a tier in the ladder table. `perks`
 * is the modern column; `benefits` is the legacy free-text one, still edited in
 * admin, and is the only thing some rows have.
 */
function headlineBenefits(tier: MembershipTierRow): string[] {
  if (tier.perks.length > 0) {
    return tier.perks.slice(0, TABLE_PERKS).map((perk) => perk.title)
  }
  return tier.benefits ? [tier.benefits] : []
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
    // No page-wide tint panel: in the mockup the cards sit straight on the
    // canvas. `--tier` therefore has to be set on each block that reads it —
    // the identity card, the progress card and the perks panel. The ladder rows
    // set their OWN accent from their index, so the table needs none.
    <div className="grid gap-4 sm:gap-6">
      {/* The mockup leaves the page title plain and moves "Current tier" onto
          the identity card below, where it labels the thing it describes. */}
      <PageHeader
        title={ti.pageTitle}
        description={ti.subtitle}
        size="display"
        className={cn(ENTER, STAGGER[0])}
      />

      {/* The four top-level regions stagger in; nothing inside them does. */}
      {!current ? (
        <div
          className={cn(
            ENTER,
            STAGGER[1],
            "border-border bg-card rounded-2xl border",
          )}
        >
          <EmptyState
            icon={Gem}
            title={ti.noTier}
            description={ti.noTierBody}
          />
        </div>
      ) : (
        <div
          className={cn(
            ENTER,
            STAGGER[1],
            "grid gap-4 sm:gap-6 md:grid-cols-12",
          )}
        >
          <section
            className={cn(
              "border-border bg-card shadow-soft relative grid content-start gap-4 overflow-hidden rounded-3xl border p-4 sm:gap-6 sm:p-6 md:col-span-5 md:p-8",
              tierAccentClass(rank),
            )}
          >
            {/* Decorative gem glow — the accent class set --tier above. */}
            <span
              aria-hidden
              className="bg-tier/20 pointer-events-none absolute -top-16 -right-16 size-56 rounded-full blur-3xl"
            />
            {/* Gated on `current` by the branch above: "Current tier" printed
                over an empty state is a statement that isn't true yet. */}
            <div className="text-label-md text-tier relative flex items-center gap-2 uppercase">
              <Gem className="size-4 shrink-0" aria-hidden />
              {ti.eyebrow}
            </div>

            <div className="relative flex items-center gap-4">
              {/* Gradient ring around a lit core, per the mockup's medallion.
                  The ring is built from --tier so a renamed or added tier still
                  gets its own metal without a new class. */}
              <span className="from-tier/40 to-tier/10 relative grid size-24 shrink-0 place-items-center rounded-full bg-gradient-to-tr p-1">
                <span className="bg-card border-card text-tier grid size-full place-items-center rounded-full border-4">
                  <Gem className="size-10" aria-hidden />
                </span>
                <span className="bg-primary text-primary-foreground border-card text-label-sm absolute -right-2 -bottom-2 rounded-full border-2 px-2 py-0.5 uppercase">
                  {ti.vipChip}
                </span>
              </span>
              <div className="grid min-w-0 gap-1">
                <span className="text-headline-lg text-tier truncate">
                  {current.name}
                </span>
                <span className="text-body-sm text-muted-foreground">
                  {ti.memberSince(memberSince)}
                </span>
                <Badge variant="secondary" className="w-fit">
                  {ti.multiplier(current.multiplier)}
                </Badge>
              </div>
            </div>

            <div className="relative grid gap-1">
              <span className="text-body-sm text-muted-foreground">
                {ti.spendLabel}
              </span>
              <span className="text-headline-md text-primary tabular-nums">
                {formatVnd(customer.lifetime_spend)}
              </span>
              {grandfathered && (
                <p className="text-body-sm text-muted-foreground">
                  {ti.grandfathered(
                    current.name,
                    monthYear.format(new Date(grandfathered.awarded_at)),
                  )}
                </p>
              )}
            </div>

            {/* Programme policy, NOT system behaviour: `customers.tier_id` is
                the highest tier ever held and is only ever raised, so nothing
                here may read as a promise that the app will demote anyone. */}
            <div className="border-border relative flex gap-3 border-t pt-4 sm:pt-6">
              <span className="bg-surface-container text-muted-foreground grid size-10 shrink-0 place-items-center rounded-xl">
                <CalendarClock className="size-5" aria-hidden />
              </span>
              <div className="grid gap-0.5">
                <span className="text-body-lg font-semibold">
                  {ti.retentionTitle}
                </span>
                <span className="text-body-sm text-muted-foreground">
                  {ti.retentionBody(current.name)}
                </span>
              </div>
            </div>

            <div className="relative">
              <MemberCardDialog
                name={customer.full_name ?? customer.phone}
                tierName={current.name}
                points={customer.lifetime_points}
                memberSince={memberSince}
                phone={maskedPhone}
              />
            </div>
          </section>

          <section
            className={cn(
              "border-border bg-card shadow-elevated grid content-center gap-4 rounded-3xl border p-4 sm:p-6 md:col-span-7 md:p-8",
              tierAccentClass(rank),
            )}
          >
            {next ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="grid gap-1">
                    <h2 className="text-headline-md">
                      {ti.progressTo(next.name)}
                    </h2>
                    <p className="text-body-sm text-muted-foreground">
                      {ti.progressCaption}
                    </p>
                  </div>
                  <p className="text-body-lg tabular-nums">
                    <span className="text-tier font-semibold">
                      {formatVnd(customer.lifetime_spend)}
                    </span>
                    <span className="text-muted-foreground">
                      {` / ${formatVnd(next.spend_threshold)}`}
                    </span>
                  </p>
                </div>
                {/* End-caps live here, not in ui/progress.tsx: the dashboard
                    renders the same component at h-2, where a size-4 dot would
                    stand taller than the track it marks. */}
                <div className="relative">
                  <Progress
                    value={progress / 100}
                    label={ti.progressTo(next.name)}
                    tone="accent"
                    className="h-4"
                  />
                  <span
                    aria-hidden
                    className="bg-tier ring-card absolute top-0 left-0 size-4 rounded-full ring-4"
                  />
                  <span
                    aria-hidden
                    className="bg-surface-highest ring-card absolute top-0 right-0 size-4 rounded-full ring-4"
                  />
                </div>
                <div className="bg-primary-container/50 flex items-center gap-4 rounded-2xl p-4">
                  <span className="bg-primary text-primary-foreground grid size-12 shrink-0 place-items-center rounded-full">
                    <ShoppingBag className="size-5" aria-hidden />
                  </span>
                  <span className="text-body-sm">
                    {ti.spendToNext(formatVnd(toNext), next.name)}
                  </span>
                </div>
              </>
            ) : (
              // Nothing to fill towards — the ring says MAX rather than a bar
              // sitting permanently at 100%.
              <div className="grid justify-items-center gap-4 text-center">
                <h2 className="text-headline-md">{ti.progressTitle}</h2>
                <TierRing
                  percent={100}
                  label={ti.maxLabel}
                  caption={current.name}
                />
                <p className="text-body-sm text-muted-foreground">
                  {ti.atTop(current.name)}
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Unguarded on purpose: someone with no tier yet still needs to see what
          the ladder costs and offers — that is the screen's whole pitch. */}
      <section
        className={cn(
          ENTER,
          STAGGER[2],
          "border-border bg-card shadow-soft overflow-hidden rounded-3xl border",
        )}
      >
        <div className="border-border bg-surface-low border-b p-4 sm:p-6">
          <h2 className="text-headline-md flex items-center gap-2">
            <Gem className="text-primary size-5" aria-hidden />
            {ti.benefitsTableTitle}
          </h2>
        </div>

        {/* Three columns of Vietnamese do not fit 360px, so a phone gets the
            same rows as cards — the pattern /history uses. */}
        <ul className="divide-border divide-y sm:hidden">
          {tiers.map((tier, index) => (
            <li
              key={tier.id}
              className={cn(
                "grid gap-2 p-4",
                tierAccentClass(index),
                tier.id === current?.id && "border-l-4 border-l-tier",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="border-tier/30 bg-tier/10 text-tier grid size-9 shrink-0 place-items-center rounded-full border">
                  <Gem className="size-4" aria-hidden />
                </span>
                <span className="text-body-lg font-semibold">{tier.name}</span>
                {tier.id === current?.id && (
                  <Badge variant="secondary">{ti.currentChip}</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body-sm text-muted-foreground tabular-nums">
                  {ti.thresholdAt(formatVnd(tier.spend_threshold))}
                </span>
                <Badge variant="muted">{ti.multiplier(tier.multiplier)}</Badge>
              </div>
              <ul className="grid gap-1">
                {headlineBenefits(tier).map((benefit) => (
                  <li
                    key={benefit}
                    className="text-body-sm flex items-start gap-2"
                  >
                    <CheckCircle
                      className="text-tier mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    {benefit}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[720px] text-left">
            <caption className="sr-only">{ti.benefitsTableTitle}</caption>
            <thead>
              <tr className="border-border text-label-md text-muted-foreground border-b tracking-wider uppercase">
                <th scope="col" className="px-6 py-3.5">
                  {ti.colTier}
                </th>
                <th scope="col" className="px-6 py-3.5">
                  {ti.colCondition}
                </th>
                <th scope="col" className="px-6 py-3.5">
                  {ti.colBenefits}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {tiers.map((tier, index) => (
                <tr
                  key={tier.id}
                  // The accent goes on the row so both the gem chip and the
                  // highlight read --tier. It carries a gradient, which is why
                  // the current row is marked with a border rather than a tint
                  // that would sit invisibly underneath it.
                  className={cn(
                    tierAccentClass(index),
                    tier.id === current?.id && "border-l-4 border-l-tier",
                  )}
                >
                  <th scope="row" className="px-6 py-4 font-semibold">
                    <div className="flex items-center gap-3">
                      <span className="border-tier/30 bg-tier/10 text-tier grid size-10 shrink-0 place-items-center rounded-full border">
                        <Gem className="size-5" aria-hidden />
                      </span>
                      <span className="text-body-lg">{tier.name}</span>
                      {tier.id === current?.id && (
                        <Badge variant="secondary">{ti.currentChip}</Badge>
                      )}
                    </div>
                  </th>
                  <td className="px-6 py-4">
                    <div className="grid justify-items-start gap-1.5">
                      <span className="text-body-sm whitespace-nowrap tabular-nums">
                        {ti.thresholdAt(formatVnd(tier.spend_threshold))}
                      </span>
                      <Badge variant="muted">
                        {ti.multiplier(tier.multiplier)}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <ul className="grid gap-1.5">
                      {headlineBenefits(tier).map((benefit) => (
                        <li
                          key={benefit}
                          className="text-body-sm flex items-start gap-2"
                        >
                          <CheckCircle
                            className="text-tier mt-0.5 size-4 shrink-0"
                            aria-hidden
                          />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {current && (
        // Not a SectionCard: the mockup's privileges panel carries a full-height
        // tier rail down its left edge, which the shared header strip has no
        // room for. This panel is also the ONLY place `perk.detail` is rendered
        // — the table above has room for titles alone.
        <section
          className={cn(
            ENTER,
            STAGGER[3],
            "border-border bg-card shadow-soft relative overflow-hidden rounded-3xl border p-4 sm:p-6 md:p-8",
            tierAccentClass(rank),
          )}
        >
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
    </div>
  )
}
