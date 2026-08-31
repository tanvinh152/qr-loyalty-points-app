import Link from "next/link"
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Gift,
  Info,
  Medal,
  PawPrint,
  Receipt,
  Route,
  Sparkles,
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
  buildRoadmap,
  claimableCount,
  nextLocked,
} from "@/lib/milestones"
import {
  getActiveRewards,
  getCheckinPoints,
  getFeaturedReward,
  getMilestoneAwards,
  getMilestoneCount,
  getMilestones,
  getTiers,
  getTransactionTotals,
  getTransactions,
  getUnfulfilledMilestoneCount,
  hasCheckedInToday,
  orderTotal,
  resolveDisplayTier,
  tierProgress,
} from "@/lib/loyalty"
import type { RewardRow } from "@/lib/db-types"
import { getAccount } from "../account"
import { RewardCard } from "../rewards/reward-card"
import { transactionCode, transactionTitle } from "../transactions"
import { CheckinButton } from "./checkin-card"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.dashboard.metaTitle }
}

// How wide each daily-action tile gets, by how many of them there are — two at
// most now that the wheel is a header control (check-in and the milestone
// ladder). A lookup rather than arithmetic because Tailwind only sees literal
// classes; add the rung back if a third tile ever returns.
const ENGAGEMENT_SPAN: Record<number, string> = {
  1: "lg:col-span-12",
  2: "lg:col-span-6",
}

// "Xem tất cả" is a text link in the mockup, not a filled chip — a second
// solid button beside a section heading competes with the card's own CTA.
// `h-auto p-0` strips the button box so the link sits flush with the heading
// baseline; the `link` variant supplies the colour and the hover underline.
const VIEW_ALL = cn(buttonVariants({ variant: "link" }), "h-auto gap-1 p-0")

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
    milestoneCount,
  ] = await Promise.all([
    getTiers(),
    getTransactions(customer.id, { page: 1, pageSize: RECENT_COUNT }),
    getActiveRewards(),
    getTransactionTotals(customer.id),
    getFeaturedReward(),
    getPublishedPosts({ limit: POST_COUNT }),
    getCheckinPoints(),
    getMilestoneCount(),
  ])
  // Only queried when the feature is on — an off admin toggle should not cost
  // every dashboard load an extra read.
  const checkedInToday =
    checkinPoints > 0 ? await hasCheckedInToday(customer.id) : false
  // Same conditional-query discipline: an unconfigured ladder must not cost
  // every dashboard load two extra reads.
  const [milestones, milestoneAwards, pendingMilestones] =
    milestoneCount > 0
      ? await Promise.all([
          getMilestones(),
          getMilestoneAwards(customer.id),
          getUnfulfilledMilestoneCount(customer.id),
        ])
      : [[], [], 0]
  const milestoneNodes = buildRoadmap(
    milestones,
    customer.lifetime_spend,
    milestoneAwards,
  )
  const milestonesReady = claimableCount(milestoneNodes)
  const nextMilestone = nextLocked(milestoneNodes)

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

  // The 4-slot's tenant. When no gift is featured the summary moves up into it,
  // so the slot is never empty and the hero can stay at a constant 8 columns.
  const summaryInAside = !featured
  // Full class strings in a lookup: Tailwind cannot see an interpolated one.
  const engagementCount = [
    checkinPoints > 0,
    milestoneNodes.length > 0,
  ].filter(Boolean).length
  const engagementSpan =
    ENGAGEMENT_SPAN[engagementCount] ?? ENGAGEMENT_SPAN[1]

  // Every tile in the bento carries the same panel treatment, so the summary is
  // a plain function rather than a nested component: it renders in one of two
  // slots depending on whether a featured gift exists, and calling it is the
  // cheapest way to say that without duplicating the markup.
  const summaryCard = (className: string) => (
    <SectionCard
      chrome="plain"
      title={d.summaryTitle}
      className={cn("flex flex-col", className)}
      bodyClassName="grow"
    >
      <dl className="divide-border divide-y">
        {summary.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6"
          >
            <dt className="text-body-sm text-muted-foreground min-w-0">
              {label}
            </dt>
            <dd className="text-body-lg text-right font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )

  return (
    <div className="grid gap-4 sm:gap-6">
      {/* No action beside the greeting: the hero below already carries the one
          CTA, and two buttons within 200px read as two destinations. The
          greeting sits OUTSIDE the bento, as in the mockup. */}
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

      {/* The bento. `auto-rows` is the mockup's minmax(180px,auto) snapped to
          the spacing scale, so a slim card never collapses to a sliver beside a
          tall neighbour. Below `lg` every tile is full width in DOM order. */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:auto-rows-[minmax(11rem,auto)] lg:grid-cols-12">
        {/* One hero widget carrying the balance, the spend and the tier journey,
            painted in the mockup's saturated brand gradient with white ink. It
            deliberately does NOT wear the tier's gem wash: the tier-colour rule
            is scoped to /tiers and the rail's member block (see AGENTS.md), and
            a gem wash cannot carry white text at five different hues. Every
            colour in here comes from --hero-*, the one token group that is
            legible on top of this gradient. */}
        <section className="bg-hero text-hero-ink shadow-elevated relative overflow-hidden rounded-4xl p-6 md:p-8 lg:col-span-8">
          <PawPrint
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-10 size-56 opacity-10"
          />
          <span
            aria-hidden
            className="bg-hero-ink/20 pointer-events-none absolute -top-16 -right-16 size-56 rounded-full blur-3xl"
          />
          {/* `content-between` pins the journey panel to the bottom when the
              bento row stretches the tile — the mockup's justify-between. */}
          <div className="relative grid h-full content-between gap-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="grid gap-3">
                <span className="bg-hero-ink/20 text-label-md inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur">
                  <Medal
                    className="text-hero-accent size-4 shrink-0"
                    aria-hidden
                  />
                  {current?.name ?? d.noTier}
                </span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-display tabular-nums">
                    {customer.current_points.toLocaleString()}
                  </span>
                  <span className="text-body-lg text-hero-ink/85">
                    {t.customer.nav.pointsUnit}
                  </span>
                </div>
                <span className="text-body-sm text-hero-ink/85">
                  {d.balanceLabel}
                </span>
              </div>
              <div className="grid gap-1 sm:text-right">
                <span className="text-body-sm text-hero-ink/85 flex items-center gap-1.5 sm:justify-end">
                  <Receipt className="size-4 shrink-0" aria-hidden />
                  {d.lifetimeSpend}
                </span>
                <span className="text-headline-md tabular-nums">
                  {formatVnd(customer.lifetime_spend)}
                </span>
              </div>
            </div>

            {/* The journey panel sits one surface step above the wash so the bar
                reads against something, not against the gradient. The CTA sits
                BESIDE the bar from `sm` up, as in the mockup. */}
            <div className="border-hero-ink/20 bg-hero-ink/10 grid gap-3 rounded-3xl border p-4 backdrop-blur-sm sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 sm:p-5">
              <div className="grid min-w-0 gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-sm flex items-center gap-1.5">
                    <Info
                      className="text-hero-ink/85 size-4 shrink-0"
                      aria-hidden
                    />
                    {next ? d.spendAway(formatVnd(toNext)) : d.topTier}
                  </p>
                  <span className="text-label-md text-hero-accent tabular-nums">
                    {d.percentComplete(progress)}
                  </span>
                </div>
                <Progress value={progress / 100} label={d.tierProgressLabel} tone="hero" />
                {/* Both ends of the band the bar is measured across — more than
                    the mockup shows, and the only way the percentage is
                    checkable. The far end is named as well as priced:
                    `spendAway` above is an amount only, so without this nothing
                    says what it buys. */}
                <div className="text-hero-ink/85 text-body-xs flex items-center justify-between gap-2">
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
              </div>
              <Link
                href="/rewards"
                className={cn(
                  buttonVariants({ variant: "onHero" }),
                  "w-full sm:w-auto",
                )}
              >
                <Sparkles className="size-4" aria-hidden />
                {t.customer.nav.rewards}
              </Link>
            </div>
          </div>
        </section>

        {/* The 4-slot. It is NEVER empty: at most one reward can be featured — a
            partial unique index says so — and when there is none the summary
            moves up here. That is what keeps the hero at a constant 8 columns
            and row 1 hole-free in every configuration. */}
        {featured
          ? (
            // No SectionCard and no "Featured gift" heading: in the mockup this
            // tile IS the gift card. RewardCard already puts its own chip on any
            // is_featured reward, so a header label would say the same thing
            // twice, 40px apart.
            <RewardCard
              reward={featured}
              currentPoints={customer.current_points}
              lockedFor={lockedFor(featured)}
              variant="feature"
              className="lg:col-span-4"
            />
          )
          : summaryCard("lg:col-span-4")}

        {/* Daily-expiring actions, so they sit ABOVE the informational panels —
            a deliberate departure from the mockup's row order, which has no
            equivalent feature and so cannot rule on it. With both of these off
            the row vanishes and the layout IS the mockup. */}
        {checkinPoints > 0 && (
          <SectionCard
            chrome="plain"
            title={d.checkinTitle}
            className={cn("flex flex-col", engagementSpan)}
            bodyClassName="flex grow flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <p className="text-body-sm text-muted-foreground">
              {d.checkinBody(checkinPoints)}
            </p>
            <CheckinButton initialCheckedIn={checkedInToday} />
          </SectionCard>
        )}

        {/* Deliberately NO second progress bar: the hero above already shows
            one measured in đồng (spend towards the next tier), and a second
            đồng bar right under it reads as the same journey twice. What is
            here instead is what a bar could not say — what is claimable now,
            and what is still sitting at the counter. */}
        {milestoneNodes.length > 0 && (
          <SectionCard
            chrome="plain"
            title={d.roadmapTitle}
            className={cn("flex flex-col", engagementSpan)}
            bodyClassName="flex grow flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="grid gap-1">
              <p className="text-body-sm text-muted-foreground">
                {milestonesReady > 0
                  ? d.roadmapReady(milestonesReady)
                  : nextMilestone
                    ? d.roadmapNext(
                        nextMilestone.milestone.name,
                        formatVnd(nextMilestone.shortfall),
                      )
                    : d.roadmapAllDone}
              </p>
              {/* A claimed milestone gift is settled by hand at the counter, so
                  the only way a member learns it is waiting is being told —
                  exactly the wheel's reasoning, one ladder over. */}
              {pendingMilestones > 0 && (
                <p className="text-body-sm text-warning flex items-center gap-1.5">
                  <Gift className="size-4 shrink-0" aria-hidden />
                  {d.roadmapPending(pendingMilestones)}
                </p>
              )}
            </div>
            <Link
              href="/rewards/roadmap"
              className={cn(
                buttonVariants({
                  variant: milestonesReady > 0 ? "default" : "muted",
                }),
              )}
            >
              <Route className="size-4" aria-hidden />
              {d.roadmapCta}
            </Link>
          </SectionCard>
        )}

        {teasers.length > 0 && (
          <SectionCard
            chrome="plain"
            title={t.customer.rewards.title}
            className="flex flex-col lg:col-span-6"
            bodyClassName="grid grow content-start gap-2 p-4 sm:p-6"
            actions={
              <Link href="/rewards" className={VIEW_ALL}>
                {d.viewAll}
              </Link>
            }
          >
            {/* The list line, not the full card: three 192px covers in a
                6-column tile would tower over the orders table beside it. */}
            {teasers.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                currentPoints={customer.current_points}
                lockedFor={lockedFor(reward)}
                variant="row"
              />
            ))}
          </SectionCard>
        )}

        {/* Unconditional — an empty ledger renders EmptyState rather than
            dropping the tile, which is what lets the rewards list above rely on
            having a partner in its row. */}
        <SectionCard
          chrome="plain"
          title={d.recentTitle}
          // A container query, NOT a viewport breakpoint: this tile's width
          // depends on whether the rail is collapsed, and that is user state.
          // The same reasoning that forbids a hardcoded md:pl-64 mirror of the
          // rail's width forbids guessing this tile's width from the viewport.
          className={cn(
            "@container/orders flex flex-col",
            teasers.length > 0 ? "lg:col-span-6" : "lg:col-span-12",
          )}
          bodyClassName="grow"
          actions={
            <Link href="/history" className={VIEW_ALL}>
              {d.viewAll}
              <ArrowRight className="size-4" aria-hidden />
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
              {/* A narrow tile has no room for four columns of Vietnamese, so it
                  gets the same rows as a list — the pattern /history already
                  uses. Every kind of row stays: a redemption belongs in this
                  list too, it simply has no order total to show. */}
              <ul className="divide-border divide-y @[30rem]/orders:hidden">
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
                            credit ? "text-success" : "text-destructive",
                          )}
                        >
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{title}</p>
                          <p className="text-label-sm text-primary truncate font-mono font-semibold">
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
                          credit ? "text-success" : "text-destructive",
                        )}
                      >
                        {credit ? `+${row.amount}` : row.amount}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <div className="hidden @[30rem]/orders:block">
                {/* Tighter gutters than the default `sm:px-6`: four columns have
                    to fit a tile that can be as narrow as 480px. The descendant
                    selector outranks the cells' own padding classes. */}
                <Table className="min-w-full [&_td]:px-3 [&_th]:px-3">
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
                        <TableCell className="max-w-[180px]">
                          {/* A reward name is admin free text and the order
                              label carries a POS code — both outrun the
                              column. */}
                          <TruncatedText className="font-semibold">
                            {title}
                          </TruncatedText>
                          <p className="text-label-sm text-primary font-mono font-semibold">
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
                            credit ? "text-success" : "text-destructive",
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

        {/* Displaced by the featured gift, so it takes a full row of its own —
            a 12 always fills its row, which is why this can never leave a
            hole. */}
        {!summaryInAside && summaryCard("lg:col-span-12")}

        {/* Deliberately NOT a SectionCard. The mockup ends the page with a bare
            heading over a 3-up grid: the post tiles are already cards, and
            nesting them inside a fourth panel gives the strip a frame nothing
            else on the page has. */}
        {posts.length > 0 && (
          <section className="col-span-full grid gap-4 sm:gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-headline-md">{d.updatesTitle}</h2>
              <Link href="/blog" className={VIEW_ALL}>
                {d.updatesViewAll}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} layout="tile" />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
