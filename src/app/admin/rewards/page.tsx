import { AlertTriangle, Coins, Gift, PackageCheck } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { StatCard } from "@/components/stat-card"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { getRewardCategories } from "@/lib/loyalty"
import { LOW_STOCK } from "@/lib/rewards"
import type { RewardRow } from "@/lib/db-types"
import { RewardCard } from "./reward-card"
import { RewardDialog } from "./reward-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.rewards.metaTitle }
}

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const t = await getMessages()
  const m = t.admin.rewards
  const { q } = await searchParams
  const search = q?.trim()

  const supabase = await createClient()
  let query = supabase.from("rewards").select("*").order("points_cost", {
    ascending: true,
  })
  if (search) query = query.ilike("name", `%${search}%`)

  const [{ data }, categories] = await Promise.all([
    query,
    getRewardCategories(),
  ])
  const rewards = (data ?? []) as RewardRow[]

  const active = rewards.filter((r) => r.is_active).length
  const lowStock = rewards.filter((r) => r.quantity <= LOW_STOCK).length
  const avgCost = rewards.length
    ? Math.round(
        rewards.reduce((sum, r) => sum + r.points_cost, 0) / rewards.length,
      )
    : 0
  // One shared scale for every stock bar in the grid.
  const maxQuantity = Math.max(0, ...rewards.map((r) => r.quantity))

  return (
    <div className="grid gap-6">
      <PageHeader title={m.title} description={m.helper}>
        <RewardDialog categories={categories} />
      </PageHeader>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={m.statTotal} value={rewards.length} icon={Gift} />
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

      <SearchInput
        action="/admin/rewards"
        defaultValue={search}
        label={t.common.search}
        placeholder={m.searchPlaceholder}
        className="sm:w-96"
      />

      {rewards.length === 0 ? (
        <EmptyState title={search ? m.noMatch : m.empty} icon={Gift} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              maxQuantity={maxQuantity}
              categories={categories}
            />
          ))}
        </div>
      )}
    </div>
  )
}
