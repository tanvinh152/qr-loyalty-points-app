import Link from "next/link"
import { Gift, History, QrCode, Sparkles } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/server"
import {
  EXCLUSIVE_CATEGORY,
  getActiveRewards,
  getFeaturedReward,
  getRewardCategories,
} from "@/lib/loyalty"
import { getAccount } from "../account"
import { RewardCard } from "./reward-card"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.rewards.metaTitle }
}

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const t = await getMessages()
  const r = t.customer.rewards
  const { customer } = await getAccount()
  if (!customer) return null

  const { category } = await searchParams
  const [rewards, categories, featured] = await Promise.all([
    getActiveRewards({ category }),
    getRewardCategories(),
    getFeaturedReward(),
  ])

  // The hero only headlines the unfiltered store: inside a filter it would sit
  // above a grid it may not even belong to.
  const hero = category ? null : featured
  const grid = hero ? rewards.filter((row) => row.id !== hero.id) : rewards

  const tabs = [
    { key: undefined, label: r.allCategories },
    ...categories.map((value) => ({ key: value, label: value })),
    { key: EXCLUSIVE_CATEGORY, label: r.exclusiveCategory },
  ]

  return (
    <div className="grid gap-6">
      {/* The header leads with the balance, not the page name: the mockup's
          eyebrow carries the title and the number is the hero. */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-1">
          <span className="text-label-md text-muted-foreground uppercase">
            {r.eyebrow}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-display text-primary tabular-nums">
              {customer.current_points.toLocaleString()}
            </span>
            <span className="text-headline-md text-muted-foreground">
              {t.customer.nav.pointsUnit}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/claim"
            className={cn(
              buttonVariants({ variant: "muted" }),
              "border-primary/30 bg-primary/15 text-primary rounded-full border",
            )}
          >
            <QrCode className="size-4" aria-hidden />
            {r.earnMoreCta}
          </Link>
          <Link
            href="/history"
            className={cn(buttonVariants({ variant: "muted" }), "rounded-full")}
          >
            <History className="size-4" aria-hidden />
            {r.historyCta}
          </Link>
        </div>
      </div>

      <nav
        aria-label={r.filterLabel}
        className="flex gap-2 overflow-x-auto pb-1 whitespace-nowrap"
      >
        {tabs.map((tab) => {
          const active = category === tab.key
          return (
            <Link
              key={tab.key ?? "all"}
              href={
                tab.key
                  ? `/rewards?category=${encodeURIComponent(tab.key)}`
                  : "/rewards"
              }
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-label-md shrink-0 rounded-full px-4 py-2 transition-colors",
                active
                  ? "bg-primary-container text-primary-foreground font-semibold"
                  : "bg-surface-container text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* One bento grid: the featured reward is a wide cell inside it, not a
          separate band above it. */}
      <div className="grid gap-6 md:grid-cols-12">
        {hero && (
          <section className="border-border bg-card grid gap-6 overflow-hidden rounded-3xl border sm:grid-cols-2 md:col-span-8">
            {hero.image_url ? (
              // Admin-entered URLs from any host, so this stays a plain <img>
              // instead of widening next.config remotePatterns to the whole web.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.image_url}
                alt=""
                width={640}
                height={360}
                className="h-full max-h-80 w-full object-cover"
              />
            ) : (
              <div className="bg-surface-container text-muted-foreground grid min-h-56 place-items-center">
                <Gift className="size-12" aria-hidden />
              </div>
            )}

            <div className="grid content-center gap-3 p-6 md:p-12">
              <span className="text-label-md text-secondary flex items-center gap-1.5 uppercase">
                <Sparkles className="size-4" aria-hidden />
                {r.featuredChip}
              </span>
              <h2 className="text-headline-lg">{hero.name}</h2>
              {hero.description && (
                <p className="text-body-sm text-muted-foreground">
                  {hero.description}
                </p>
              )}
              <RewardCard
                reward={hero}
                currentPoints={customer.current_points}
                variant="bare"
              />
            </div>
          </section>
        )}

        {grid.map((reward) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            currentPoints={customer.current_points}
            className="md:col-span-4"
          />
        ))}
      </div>

      {grid.length === 0 && !hero && (
        <div className="border-border bg-card rounded-3xl border">
          <EmptyState
            icon={Gift}
            title={r.emptyTitle}
            description={r.emptyBody}
          />
        </div>
      )}
    </div>
  )
}
