import Link from "next/link"
import {
  AlertTriangle,
  Coins,
  Gift,
  PackageCheck,
  PieChart,
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
import { SpinPrizeCard } from "./spin-prize-card"
import { SpinPrizeDialog } from "./spin-prize-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.rewards.metaTitle }
}

/**
 * Every gift, of both kinds, on one screen (0022). `kind` picks the tab: the
 * shop's catalog or the wheel's slices. They share a table but not a single
 * column beyond name/image/active, so each tab gets its own stats, its own
 * grid and its own dialog rather than one form full of inapplicable fields.
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
  const kind: RewardKind = kindParam === "spin" ? "spin" : "redeem"

  const supabase = await createClient()
  let query = supabase.from("rewards").select("*").eq("kind", kind)
  if (search) query = query.ilike("name", `%${search}%`)
  // Slices render in wheel order — the same ordering the draw's running-total
  // window uses, so the admin's list and the wheel agree.
  query =
    kind === "spin"
      ? query.order("sort_order").order("id")
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
      labels={{ redeem: m.tabRedeem, spin: m.tabSpin }}
    />
  )
  const searchBox = (
    <SearchInput
      action="/admin/rewards"
      defaultValue={search}
      label={t.common.search}
      placeholder={kind === "spin" ? m.spin.searchPlaceholder : m.searchPlaceholder}
      hidden={kind === "spin" ? { kind } : undefined}
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
