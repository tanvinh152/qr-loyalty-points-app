import Link from "next/link"
import {
  AlertTriangle,
  Coins,
  Gift,
  PackageCheck,
  PieChart,
  Route,
  Scale,
  Trophy,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { StatCard } from "@/components/stat-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { getRewardCategories, getSpinDailyLimit, getTiers } from "@/lib/loyalty"
import { LOW_STOCK } from "@/lib/rewards"
import { isDrawable } from "@/lib/spin"
import type { RewardKind, RewardRow } from "@/lib/db-types"
import { KindTabs } from "./kind-tabs"
import { RewardCard } from "./reward-card"
import { RewardDialog } from "./reward-form"
import { MilestoneCard } from "./milestone-card"
import { MilestoneDialog } from "./milestone-form"
import { SpinPrizeCard } from "./spin-prize-card"
import { SpinPrizeDialog } from "./spin-prize-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.rewards.metaTitle }
}

/**
 * Every gift, of all three kinds, on one screen (0022, 0024). `kind` picks the
 * tab: the shop's catalog, the wheel's slices or the spend ladder's rungs. They
 * share a table but not a single column beyond name/image/active, so each tab
 * gets its own stats, its own grid and its own dialog rather than one form full
 * of inapplicable fields.
 */
export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>
}) {
  const t = await getMessages()
  const m = t.admin.rewards
  const { q, kind: kindParam } = await searchParams
  const search = q?.trim()
  const kind: RewardKind =
    kindParam === "spin"
      ? "spin"
      : kindParam === "milestone"
        ? "milestone"
        : "redeem"

  const supabase = await createClient()
  let query = supabase.from("rewards").select("*").eq("kind", kind)
  if (search) query = query.ilike("name", `%${search}%`)
  // Slices render in wheel order — the same ordering the draw's running-total
  // window uses, so the admin's list and the wheel agree.
  query =
    kind === "spin"
      ? query.order("sort_order").order("id")
      : kind === "milestone"
        // Cheapest rung first — the ladder's own order, matching
        // rewards_milestone_threshold_idx and the customer's roadmap.
        ? query.order("spend_threshold", { ascending: true })
        : query.order("points_cost", { ascending: true })

  const [{ data }, categories, tiers, spinDailyLimit] = await Promise.all([
    query,
    getRewardCategories(),
    getTiers(),
    kind === "spin" ? getSpinDailyLimit() : Promise.resolve(0),
  ])
  const rows = (data ?? []) as RewardRow[]

  const tabs = (
    <KindTabs
      active={kind}
      search={search}
      labels={{
        redeem: m.tabRedeem,
        spin: m.tabSpin,
        milestone: m.tabMilestone,
      }}
    />
  )
  const searchBox = (
    <SearchInput
      action="/admin/rewards"
      defaultValue={search}
      label={t.common.search}
      placeholder={
        kind === "spin"
          ? m.spin.searchPlaceholder
          : kind === "milestone"
            ? m.milestone.searchPlaceholder
            : m.searchPlaceholder
      }
      // Without this the search form posts without `kind` and drops the tab.
      hidden={kind === "redeem" ? undefined : { kind }}
      className="sm:w-96"
    />
  )

  if (kind === "spin") {
    const ms = m.spin
    // The denominator has to be the set the RPC would actually draw from, or
    // the percentages on the cards are a different wheel from the real one.
    const drawable = rows.filter(isDrawable)
    const totalWeight = drawable.reduce((sum, r) => sum + r.weight, 0)
    const soldOut = rows.filter(
      (r) => r.is_active && r.prize_type === "gift" && r.quantity <= 0,
    ).length

    return (
      <div className="grid gap-6">
        <PageHeader title={m.title} description={ms.helper}>
          {/* The hand-over queue has no other entry point: a gift slice is
              configured here but settled on its own screen. */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/spin/winners"
              className={buttonVariants({ variant: "secondary" })}
            >
              <Trophy className="size-4" aria-hidden />
              {t.admin.spin.winners.viewWinners}
            </Link>
            <SpinPrizeDialog />
          </div>
        </PageHeader>

        {tabs}

        {spinDailyLimit <= 0 && (
          <Alert>
            <AlertTriangle aria-hidden />
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {ms.disabledWarning}
              <Link
                href="/admin/settings"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                {ms.goToSettings}
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {rows.length > 0 && totalWeight <= 0 && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertDescription>{ms.noWeightWarning}</AlertDescription>
          </Alert>
        )}

        {soldOut > 0 && totalWeight > 0 && (
          <Alert>
            <AlertTriangle aria-hidden />
            <AlertDescription>{ms.outOfStockWarning(soldOut)}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={ms.statSlices}
            value={drawable.length}
            hint={ms.statSlicesHint}
            icon={PieChart}
          />
          <StatCard
            label={m.statActive}
            value={rows.filter((r) => r.is_active).length}
            icon={PackageCheck}
            tone="secondary"
          />
          <StatCard
            label={ms.statTotalWeight}
            value={totalWeight}
            hint={ms.statTotalWeightHint}
            icon={Scale}
          />
          <StatCard
            label={ms.statOutOfStock}
            value={soldOut}
            hint={ms.statOutOfStockHint}
            icon={AlertTriangle}
            tone="neutral"
          />
        </div>

        {searchBox}

        {rows.length === 0 ? (
          <EmptyState title={search ? ms.noMatch : ms.empty} icon={Gift} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((prize) => (
              <SpinPrizeCard
                key={prize.id}
                prize={prize}
                totalWeight={totalWeight}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (kind === "milestone") {
    const mm = m.milestone

    // Claims per rung, counted in JS from one narrow query — the same trade
    // `getRewardCategories` makes: PostgREST has no GROUP BY, and one query for
    // a single uuid column beats one HEAD request per rung.
    const [{ data: awardRows }, { count: pending }] = await Promise.all([
      supabase.from("milestone_awards").select("milestone_id"),
      supabase
        .from("milestone_awards")
        .select("id", { count: "exact", head: true })
        .is("fulfilled_at", null),
    ])
    const claimsBy = new Map<string, number>()
    for (const row of awardRows ?? []) {
      const id = (row as { milestone_id: string | null }).milestone_id
      if (id) claimsBy.set(id, (claimsBy.get(id) ?? 0) + 1)
    }
    const pendingCount = pending ?? 0

    return (
      <div className="grid gap-6">
        <PageHeader title={m.title} description={mm.helper}>
          {/* The hand-over queue has no other entry point: a rung is configured
              here but settled on its own screen, exactly like a wheel gift. */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/milestones/awards"
              className={buttonVariants({ variant: "secondary" })}
            >
              <Trophy className="size-4" aria-hidden />
              {mm.viewAwards}
            </Link>
            <MilestoneDialog />
          </div>
        </PageHeader>

        {tabs}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={mm.statMilestones}
            value={rows.length}
            hint={mm.statMilestonesHint}
            icon={Route}
          />
          <StatCard
            label={mm.statActive}
            value={rows.filter((r) => r.is_active).length}
            icon={PackageCheck}
            tone="secondary"
          />
          <StatCard
            label={mm.statClaimed}
            value={awardRows?.length ?? 0}
            hint={mm.statClaimedHint}
            icon={Gift}
          />
          <StatCard
            label={mm.statPending}
            value={pendingCount}
            hint={mm.statPendingHint}
            icon={Trophy}
            highlight={pendingCount > 0}
          />
        </div>

        {searchBox}

        {rows.length === 0 ? (
          <EmptyState title={search ? mm.noMatch : mm.empty} icon={Route} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((milestone) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                claims={claimsBy.get(milestone.id) ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const active = rows.filter((r) => r.is_active).length
  const lowStock = rows.filter((r) => r.quantity <= LOW_STOCK).length
  const avgCost = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.points_cost, 0) / rows.length)
    : 0
  // One shared scale for every stock bar in the grid.
  const maxQuantity = Math.max(0, ...rows.map((r) => r.quantity))

  return (
    <div className="grid gap-6">
      <PageHeader title={m.title} description={m.redeemHelper}>
        <RewardDialog categories={categories} tiers={tiers} />
      </PageHeader>

      {tabs}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={m.statTotal} value={rows.length} icon={Gift} />
        <StatCard
          label={m.statActive}
          value={active}
          icon={PackageCheck}
          tone="secondary"
        />
        <StatCard
          label={m.statLowStock}
          value={lowStock}
          hint={m.statLowStockHint(LOW_STOCK)}
          icon={AlertTriangle}
          tone="neutral"
        />
        <StatCard label={m.statAvgCost} value={avgCost} icon={Coins} />
      </div>

      {searchBox}

      {rows.length === 0 ? (
        <EmptyState title={search ? m.noMatch : m.empty} icon={Gift} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              maxQuantity={maxQuantity}
              categories={categories}
              tiers={tiers}
            />
          ))}
        </div>
      )}
    </div>
  )
}
