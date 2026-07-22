import Link from "next/link"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Gift,
  History,
  Info,
  Medal,
  QrCode,
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
import { cn } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import {
  getActiveRewards,
  getNextReward,
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

  const [tiers, recent, nextReward, rewards] = await Promise.all([
    getTiers(),
    getTransactions(customer.id, { page: 1, pageSize: RECENT_COUNT }),
    getNextReward(customer.current_points),
    getActiveRewards(),
  ])

  const {
    current,
    next,
    floor,
    percent: progress,
    toNext,
  } = tierProgress(tiers, customer.lifetime_points)

  const teasers = rewards.slice(0, TEASER_COUNT)

  return (
    <div className="grid gap-6">
      <PageHeader
        title={d.greeting(customer.full_name ?? customer.phone)}
        description={d.eyebrow}
      >
        <Link href="/claim" className={cn(buttonVariants({ size: "lg" }))}>
          <QrCode className="size-5" aria-hidden />
          {t.customer.nav.scan}
        </Link>
      </PageHeader>

      {/* The mockup opens on two summary tiles — tier first, balance second —
          and keeps the tier journey in its own centred card below them. */}
      <div className="grid gap-6 sm:grid-cols-2">
        <StatCard
          label={d.tierLabel}
          value={current ? current.name : d.noTier}
          hint={d.lifetimeHint(customer.lifetime_points)}
          icon={Medal}
        />
        <StatCard
          label={d.balanceLabel}
          value={customer.current_points}
          icon={Wallet}
          tone="secondary"
          highlight
        />
      </div>

      <section
        className={cn(
          "border-border relative overflow-hidden rounded-3xl border p-6 md:p-12",
          // The card takes the current tier's gem colour as a wash; every other
          // surface on the page stays neutral.
          // getTiers() already returns rows sorted by threshold.
          tierAccentClass(tierRank(tiers, current?.id)),
        )}
      >
        <div className="mx-auto grid max-w-xl gap-4 text-center">
          <h2 className="text-headline-md">{d.journeyTitle}</h2>

          <div className="grid gap-2">
            <div className="text-label-md flex items-center justify-between gap-2 uppercase">
              <span className="text-muted-foreground">
                {current ? current.name : d.noTier}
              </span>
              <span className="text-tier font-semibold">
                {d.percentComplete(progress)}
              </span>
              <span className="text-muted-foreground">
                {next ? next.name : d.topTier}
              </span>
            </div>
            <Progress
              value={progress / 100}
              label={d.tierProgressLabel}
              accent
            />
            <div className="text-muted-foreground text-body-xs flex items-center justify-between tabular-nums">
              <span>{floor.toLocaleString()}</span>
              {next && <span>{next.threshold.toLocaleString()}</span>}
            </div>
          </div>

          <p className="text-body-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <Info className="size-4 shrink-0" aria-hidden />
            {next ? d.pointsAway(toNext) : d.topTier}
          </p>

          <Link
            href="/tiers"
            className={cn(
              buttonVariants({ variant: "muted" }),
              "mx-auto rounded-full",
            )}
          >
            {t.customer.nav.tiers}
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
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
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
        footer={
          recent.rows.length > 0 ? (
            <Link
              href="/history"
              className="text-primary text-label-md w-full text-center hover:underline"
            >
              {d.viewAllActivity}
            </Link>
          ) : undefined
        }
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
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "bg-surface-container grid size-12 shrink-0 place-items-center rounded-xl",
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

      {nextReward && (
        <SectionCard title={d.featuredTitle}>
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <Sparkles className="text-secondary size-4" aria-hidden />
                <span className="text-headline-md">{nextReward.name}</span>
                <Badge variant="secondary">
                  {t.customer.rewards.cost(nextReward.points_cost)}
                </Badge>
              </div>
              <p className="text-body-sm text-muted-foreground">
                {d.featuredAway(
                  Math.max(0, nextReward.points_cost - customer.current_points),
                  nextReward.name,
                )}
              </p>
            </div>
            <Link
              href="/rewards"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              <Gift className="size-4" aria-hidden />
              {d.featuredCta}
            </Link>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
