import Link from "next/link"
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  FerrisWheel,
  Gift,
  History,
  Info,
  Medal,
  Newspaper,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react"

import { Progress } from "@/components/ui/progress"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { PostCard } from "@/components/post-card"
import { SectionCard } from "@/components/section-card"
import { TruncatedText } from "@/components/truncated-text"
import { cn, formatVnd } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getPublishedPosts } from "@/lib/blog"
import {
  getActiveRewards,
  getCheckinPoints,
  getFeaturedReward,
  getSpinDailyLimit,
  getSpinsUsedToday,
  getTiers,
  getTransactionTotals,
  getTransactions,
  getUncollectedGiftCount,
  hasCheckedInToday,
  orderTotal,
  resolveDisplayTier,
  tierProgress,
} from "@/lib/loyalty"
import type { RewardRow } from "@/lib/db-types"
import { getAccount } from "../account"
import { RewardCard } from "../rewards/reward-card"
import { tierAccentClass, tierRank } from "../tier-accent"
import { transactionCode, transactionTitle } from "../transactions"
import { CheckinButton } from "./checkin-card"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.dashboard.metaTitle }
}

const RECENT_COUNT = 5
const TEASER_COUNT = 3
const POST_COUNT = 3

export default async function DashboardPage() {
  const t = await getMessages()
  const d = t.customer.dashboard
  const { customer } = await getAccount()
  // The layout renders the "no points account" notice in this case.
  if (!customer) return null

  const locale = await getLocale()
  const dateFormat = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    { dateStyle: "medium" },
  )

  const [
    tiers,
    recent,
    rewards,
    totals,
    featured,
    posts,
    checkinPoints,
    spinDailyLimit,
  ] = await Promise.all([
    getTiers(),
    getTransactions(customer.id, { page: 1, pageSize: RECENT_COUNT }),
    getActiveRewards(),
    getTransactionTotals(customer.id),
    getFeaturedReward(),
    getPublishedPosts({ limit: POST_COUNT }),
    getCheckinPoints(),
    getSpinDailyLimit(),
  ])
  // Only queried when the feature is on — an off admin toggle should not cost
  // every dashboard load an extra read.
  const checkedInToday =
    checkinPoints > 0 ? await hasCheckedInToday(customer.id) : false
  const [spinsUsed, uncollectedGifts] =
    spinDailyLimit > 0
      ? await Promise.all([
          getSpinsUsedToday(customer.id),
          getUncollectedGiftCount(customer.id),
        ])
      : [0, 0]
  const spinsLeft = Math.max(0, spinDailyLimit - spinsUsed)

  const {
    current,
    next,
    floor,
    percent: progress,
    toNext,
  } = tierProgress(tiers, customer.lifetime_spend, customer)

  // Same gate as the shop, and for the same reason: without it a tier-locked
  // reward would read as redeemable here and locked one screen over.
  const displayThreshold = resolveDisplayTier(tiers, customer)?.spend_threshold ?? -1
  const tiersById = new Map(tiers.map((tier) => [tier.id, tier]))
  function lockedFor(reward: RewardRow) {
    if (!reward.min_tier_id) return null
    const minTier = tiersById.get(reward.min_tier_id)
    if (!minTier || minTier.spend_threshold <= displayThreshold) return null
    return minTier
  }

  // The featured gift has its own card below, so it must not also fill a teaser
  // slot — the same one-line exclusion /rewards makes.
  const teasers = rewards
    .filter((reward) => reward.id !== featured?.id)
    .slice(0, TEASER_COUNT)

  const entries = recent.rows.map((row) => ({
    row,
    credit: row.amount >= 0,
    code: transactionCode(row),
    title: transactionTitle(row, t.customer.history),
    total: orderTotal(row),
  }))

  // Five label/value pairs — a definition list, not a table: there are no
  // columns to head and nothing to scroll sideways at 360px.
  const summary: { label: string; value: string }[] = [
    { label: d.summarySpend, value: formatVnd(customer.lifetime_spend) },
    { label: d.summaryEarned, value: customer.lifetime_points.toLocaleString() },
    { label: d.summaryUsed, value: totals.spent.toLocaleString() },
    { label: d.summaryBalance, value: customer.current_points.toLocaleString() },
    { label: d.summaryTier, value: current?.name ?? d.noTier },
  ]

  return (
    <div className="grid gap-4 sm:gap-6">
      {/* No action beside the greeting: the hero below already carries the one
          CTA, and two buttons within 200px read as two destinations. */}
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
      />

      {/* One hero widget carrying the balance, the spend and the tier journey.
          The mockup paints it in a saturated brand gradient; this keeps the
          tier's own gem wash instead, which stays legible in both themes and
          holds to the rule that a tier is always read by its colour. */}
      <section
        className={cn(
          "border-border shadow-soft relative overflow-hidden rounded-4xl border p-6 md:p-8",
          tierAccentClass(tierRank(tiers, current?.id)),
        )}
      >
        <span
          aria-hidden
          className="bg-tier/20 pointer-events-none absolute -top-16 -right-16 size-56 rounded-full blur-3xl"
        />
        <div className="relative grid gap-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="grid gap-3">
              <span className="border-tier/30 bg-tier/10 text-tier text-label-md inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5">
                <Medal className="size-4 shrink-0" aria-hidden />
                {current?.name ?? d.noTier}
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-display text-primary tabular-nums">
                  {customer.current_points.toLocaleString()}
                </span>
                <span className="text-body-lg text-muted-foreground">
                  {t.customer.nav.pointsUnit}
                </span>
              </div>
              <span className="text-body-sm text-muted-foreground">
                {d.balanceLabel}
              </span>
            </div>
            <div className="grid gap-1 sm:text-right">
              <span className="text-body-sm text-muted-foreground flex items-center gap-1.5 sm:justify-end">
                <Receipt className="size-4 shrink-0" aria-hidden />
                {d.lifetimeSpend}
              </span>
              <span className="text-headline-md tabular-nums">
                {formatVnd(customer.lifetime_spend)}
              </span>
            </div>
          </div>

          {/* The journey panel sits one surface step above the wash so the bar
              reads against something, not against the gradient. */}
          <div className="border-border/60 bg-card/70 grid gap-3 rounded-3xl border p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-body-sm flex items-center gap-1.5">
                <Info className="text-muted-foreground size-4 shrink-0" aria-hidden />
                {next ? d.spendAway(formatVnd(toNext)) : d.topTier}
              </p>
              <span className="text-label-md text-tier tabular-nums">
                {d.percentComplete(progress)}
              </span>
            </div>
            <Progress value={progress / 100} label={d.tierProgressLabel} accent />
            {/* Both ends of the band the bar is measured across — more than the
                mockup shows, and the only way the percentage is checkable. The
                far end is named as well as priced: `spendAway` above is an
                amount only, so without this nothing says what it buys. */}
            <div className="text-muted-foreground text-body-xs flex items-center justify-between gap-2">
              <span className="tabular-nums whitespace-nowrap">
                {formatVnd(floor)}
              </span>
              <span className="min-w-0 truncate text-right">
                {next ? (
                  <>
                    <span className="tabular-nums">
                      {formatVnd(next.spend_threshold)}
                    </span>
                    {` · ${next.name}`}
                  </>
                ) : (
                  d.topTierShort
                )}
              </span>
            </div>
            <Link
              href="/rewards"
              className={cn(buttonVariants(), "w-full sm:w-fit sm:justify-self-end")}
            >
              <Sparkles className="size-4" aria-hidden />
              {t.customer.nav.rewards}
            </Link>
          </div>
        </div>
      </section>

      <SectionCard title={d.summaryTitle} icon={Wallet}>
        <dl className="divide-border divide-y">
          {summary.map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6"
            >
              <dt className="text-body-sm text-muted-foreground">{label}</dt>
              <dd className="text-body-lg text-right font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      {checkinPoints > 0 && (
        <SectionCard
          title={d.checkinTitle}
          icon={CalendarCheck}
          bodyClassName="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <p className="text-body-sm text-muted-foreground">
            {d.checkinBody(checkinPoints)}
          </p>
          <CheckinButton initialCheckedIn={checkedInToday} />
        </SectionCard>
      )}

      {spinDailyLimit > 0 && (
        <SectionCard
          title={d.spinTitle}
          icon={FerrisWheel}
          bodyClassName="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div className="grid gap-1">
            <p className="text-body-sm text-muted-foreground">
              {spinsLeft > 0 ? d.spinBody(spinsLeft) : d.spinBodyEmpty}
            </p>
            {/* A gift won on the wheel is settled by hand at the counter, so
                the only way a member learns it is waiting is being told. */}
            {uncollectedGifts > 0 && (
              <p className="text-body-sm text-warning flex items-center gap-1.5">
                <Gift className="size-4 shrink-0" aria-hidden />
                {d.spinPendingGifts(uncollectedGifts)}
              </p>
            )}
          </div>
          <Link href="/spin" className={cn(buttonVariants({ size: "lg" }))}>
            <FerrisWheel className="size-5" aria-hidden />
            {d.spinCta}
          </Link>
        </SectionCard>
      )}

      {/* At most one reward can be featured — a partial unique index says so —
          so this is a single card, and it disappears when there is none. */}
      {featured && (
        <SectionCard
          title={d.featuredTitle}
          icon={Sparkles}
          // No badge in the header: RewardCard already puts its own chip on any
          // is_featured reward, and two labels for one fact side by side is the
          // duplication the handover doc warned about.
          bodyClassName="p-4 sm:p-6"
        >
          <RewardCard
            reward={featured}
            currentPoints={customer.current_points}
            lockedFor={lockedFor(featured)}
            className="sm:max-w-sm"
          />
        </SectionCard>
      )}

      {teasers.length > 0 && (
        <SectionCard
          title={t.customer.rewards.title}
          icon={Gift}
          actions={
            <Link
              href="/rewards"
              className={cn(buttonVariants({ variant: "muted", size: "sm" }))}
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
                lockedFor={lockedFor(reward)}
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
            className={cn(buttonVariants({ variant: "muted", size: "sm" }))}
          >
            {d.viewAll}
          </Link>
        }
        // No footer link: the header action already goes to /history, and two
        // "view all" CTAs on one card read as two different destinations.
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={d.emptyTitle}
            description={d.emptyBody}
          />
        ) : (
          <>
            {/* A phone has no room for four columns of Vietnamese, so it gets
                the same rows as a list — the pattern /history already uses.
                Every kind of row stays: a redemption belongs in this list too,
                it simply has no order total to show. */}
            <ul className="divide-border divide-y sm:hidden">
              {entries.map(({ row, credit, code, title, total }) => {
                const Icon = credit ? ArrowUpRight : ArrowDownLeft
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "bg-surface-container grid size-10 shrink-0 place-items-center rounded-xl",
                          credit ? "text-secondary" : "text-destructive",
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{title}</p>
                        <p className="text-label-sm text-muted-foreground truncate font-mono">
                          {code}
                        </p>
                        <p className="text-body-xs text-muted-foreground tabular-nums">
                          {dateFormat.format(new Date(row.created_at))}
                          {total !== null && ` · ${formatVnd(total)}`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-bold tabular-nums",
                        credit ? "text-secondary" : "text-destructive",
                      )}
                    >
                      {credit ? `+${row.amount}` : row.amount}
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{d.colOrder}</TableHead>
                    <TableHead>{d.colDate}</TableHead>
                    <TableHead className="text-right">{d.colTotal}</TableHead>
                    <TableHead className="text-right">{d.colPoints}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(({ row, credit, code, title, total }) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[280px]">
                        {/* A reward name is admin free text and the order label
                            carries a POS code — both outrun the column. */}
                        <TruncatedText className="font-semibold">
                          {title}
                        </TruncatedText>
                        <p className="text-label-sm text-muted-foreground font-mono">
                          {code}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {dateFormat.format(new Date(row.created_at))}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {total === null ? (
                          <span className="text-muted-foreground">
                            {d.noOrderTotal}
                          </span>
                        ) : (
                          formatVnd(total)
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-bold tabular-nums",
                          credit ? "text-secondary" : "text-destructive",
                        )}
                      >
                        {credit ? `+${row.amount}` : row.amount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </SectionCard>

      {posts.length > 0 && (
        <SectionCard
          title={d.updatesTitle}
          icon={Newspaper}
          actions={
            <Link
              href="/blog"
              className={cn(buttonVariants({ variant: "muted", size: "sm" }))}
            >
              {d.updatesViewAll}
            </Link>
          }
        >
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} layout="tile" />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
