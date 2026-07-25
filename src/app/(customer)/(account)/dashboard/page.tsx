import Link from "next/link"
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Gift,
  History,
  Info,
  Medal,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { SectionCard } from "@/components/section-card"
import { StatCard } from "@/components/stat-card"
import { cn, formatVnd } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import {
  getActiveRewards,
  getTiers,
  getTransactions,
  tierProgress,
} from "@/lib/loyalty"
import { getAccount } from "../account"
import { RewardCard } from "../rewards/reward-card"
import { tierAccentClass, tierRank } from "../tier-accent"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.dashboard.metaTitle }
}

const RECENT_COUNT = 5
const TEASER_COUNT = 3

export default async function DashboardPage() {
  const t = await getMessages()
  const d = t.customer.dashboard
  const { customer } = await getAccount()
  // The layout renders the "no points account" notice in this case.
  if (!customer) return null

  const locale = await getLocale()
  const dateFormat = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  )

  const [tiers, recent, rewards] = await Promise.all([
    getTiers(),
    getTransactions(customer.id, { page: 1, pageSize: RECENT_COUNT }),
    getActiveRewards(),
  ])

  const {
    current,
    next,
    floor,
    percent: progress,
    toNext,
  } = tierProgress(tiers, customer.lifetime_spend, customer)

  const teasers = rewards.slice(0, TEASER_COUNT)

  return (
    <div className="grid gap-4 sm:gap-6">
      <PageHeader
        size="display"
        title={d.greeting(customer.full_name ?? customer.phone)}
        // The subtitle is where the pet lives: named once the profile has one,
        // a nudge back to /profile while it hasn't.
        description={
          customer.pet_name ? (
            d.petLine(customer.pet_name)
          ) : (
            <Link href="/profile" className="text-primary hover:underline">
              {d.addPetCta}
              <ArrowRight className="ml-1 inline size-4" aria-hidden />
            </Link>
          )
        }
      >
        {/* Points arrive on their own now (webhook), so the header's action is
            spending them rather than claiming them. */}
        <Link href="/rewards" className={cn(buttonVariants({ size: "lg" }))}>
          <Sparkles className="size-5" aria-hidden />
          {t.customer.nav.rewards}
        </Link>
      </PageHeader>

      {/* The mockup opens on exactly two hero tiles — tier first, balance
          second — and keeps the tier journey in its own centred card below
          them. Lifetime spend is not a third tile: it belongs to the journey
          card, since spend is what the journey measures. */}
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <StatCard
          label={d.tierLabel}
          value={current ? current.name : d.noTier}
          // Spend, not lifetime points: points buy rewards and decide nothing
          // about the tier, so pairing them here read as a promotion rule.
          hint={d.spendHint(formatVnd(customer.lifetime_spend))}
          icon={Medal}
          tone="tier"
          size="display"
          // The tile takes the gem wash so the tier reads as its colour here
          // and on the journey card below. getTiers() is threshold-sorted.
          className={tierAccentClass(tierRank(tiers, current?.id))}
        />
        <StatCard
          label={d.balanceLabel}
          value={customer.current_points}
          icon={Wallet}
          tone="secondary"
          size="display"
          highlight
          badge={<Badge variant="secondary">{t.customer.nav.pointsUnit}</Badge>}
        />
      </div>

      <section
        className={cn(
          "border-border relative overflow-hidden rounded-3xl border p-4 sm:p-6 md:p-12",
          // The card takes the current tier's gem colour as a wash; every other
          // surface on the page stays neutral.
          // getTiers() already returns rows sorted by threshold.
          tierAccentClass(tierRank(tiers, current?.id)),
        )}
      >
        <div className="mx-auto grid max-w-xl gap-4 text-center">
          <h2 className="text-headline-md">{d.journeyTitle}</h2>
          {/* The spend total lives here rather than in a third tile: it is the
              number the bar below is measured against. */}
          <p className="text-body-sm text-muted-foreground -mt-2">
            <span className="flex flex-wrap items-center justify-center gap-1.5">
              <Receipt className="size-4 shrink-0" aria-hidden />
              {d.lifetimeSpend}
              <span className="text-foreground font-semibold tabular-nums">
                {formatVnd(customer.lifetime_spend)}
              </span>
            </span>
          </p>

          <div className="grid gap-2">
            {/* A grid, not a three-way `justify-between`: tier names are admin
                free text, and at 12px uppercase two long ones crush the percent
                between them instead of each keeping a third of the row. */}
            <div className="text-label-md grid grid-cols-3 items-center gap-2 uppercase">
              <span className="text-muted-foreground min-w-0 truncate text-left">
                {current ? current.name : d.noTier}
              </span>
              <span className="text-tier min-w-0 truncate text-center font-semibold">
                {d.percentComplete(progress)}
              </span>
              {/* A third of an uppercase row truncates a sentence to nonsense,
                  so the top-tier case gets its own short label — the full
                  sentence is below the bar. */}
              <span className="text-muted-foreground min-w-0 truncate text-right">
                {next ? next.name : d.topTierShort}
              </span>
            </div>
            <Progress
              value={progress / 100}
              label={d.tierProgressLabel}
              accent
            />
            <div className="text-muted-foreground text-body-xs flex items-center justify-between gap-2 tabular-nums">
              <span className="whitespace-nowrap">{formatVnd(floor)}</span>
              {next && (
                <span className="whitespace-nowrap">
                  {formatVnd(next.spend_threshold)}
                </span>
              )}
            </div>
          </div>

          <p className="text-body-sm text-muted-foreground flex flex-wrap items-center justify-center gap-1.5">
            <Info className="size-4 shrink-0" aria-hidden />
            {next ? d.spendAway(formatVnd(toNext)) : d.topTier}
          </p>

          <Link
            href="/tiers"
            className={cn(
              buttonVariants({ variant: "muted" }),
              "mx-auto rounded-full",
            )}
          >
            {d.tiersCta}
            <Medal className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      {teasers.length > 0 && (
        <SectionCard
          title={t.customer.rewards.title}
          icon={Gift}
          actions={
            <Link
              href="/rewards"
              className={cn(
                buttonVariants({ variant: "muted", size: "sm" }),
                "rounded-full",
              )}
            >
              {d.viewAll}
            </Link>
          }
        >
          {/* Same card as the shop, so a reward looks identical in both places. */}
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            {teasers.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                currentPoints={customer.current_points}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={d.recentTitle}
        icon={History}
        actions={
          <Link
            href="/history"
            className={cn(
              buttonVariants({ variant: "muted", size: "sm" }),
              "rounded-full",
            )}
          >
            {d.viewAll}
          </Link>
        }
        // No footer link: the header action already goes to /history, and two
        // "view all" CTAs on one card read as two different destinations.
      >
        {recent.rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={d.emptyTitle}
            description={d.emptyBody}
          />
        ) : (
          <ul className="divide-border divide-y">
            {recent.rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "bg-surface-container grid size-10 shrink-0 place-items-center rounded-xl sm:size-12",
                      row.amount >= 0 ? "text-secondary" : "text-destructive",
                    )}
                  >
                    {row.amount >= 0 ? (
                      <ArrowUpRight className="size-5" aria-hidden />
                    ) : (
                      <ArrowDownLeft className="size-5" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-body-lg truncate">
                      {row.type === "EARN"
                        ? t.customer.history.earn(row.order_code)
                        : row.type === "REDEEM"
                          ? t.customer.history.redeem
                          : t.customer.history.adjust}
                    </p>
                    <p className="text-body-sm text-muted-foreground flex items-center gap-1.5">
                      <Clock className="size-3.5 shrink-0" aria-hidden />
                      {dateFormat.format(new Date(row.created_at))}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "text-headline-md font-bold tabular-nums",
                      row.amount >= 0 ? "text-secondary" : "text-destructive",
                    )}
                  >
                    {row.amount >= 0 ? `+${row.amount}` : row.amount}
                  </span>
                  <p className="text-label-sm text-muted-foreground uppercase">
                    {t.customer.nav.pointsUnit}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
