import { Flame, Gift, Sparkles } from "lucide-react"

import { ConfirmDelete } from "@/components/confirm-delete"
import { TruncatedText } from "@/components/truncated-text"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getMessages } from "@/lib/i18n/server"
import type { MembershipTierRow, RewardRow } from "@/lib/db-types"
import { RewardDialog } from "./reward-form"
import { deleteReward } from "./actions"

/**
 * One tile in the reward grid: image with a points pill, name, then a stock bar.
 * Out of stock turns the bar and its caption destructive.
 *
 * The image URL is admin-supplied and can point anywhere, so this stays a plain
 * `<img>` — `next/image` would need every possible host in `remotePatterns`.
 * Width and height are set to keep the tile from reflowing as it loads.
 */
export async function RewardCard({
  reward,
  maxQuantity,
  categories,
  tiers,
}: {
  reward: RewardRow
  /** Largest stock across the grid, so the bars share one scale. */
  maxQuantity: number
  /** Passed straight through to the edit dialog's category datalist. */
  categories: string[]
  /** Passed straight through to the edit dialog's minimum-tier picker. */
  tiers: MembershipTierRow[]
}) {
  const t = await getMessages()
  const m = t.admin.rewards
  const soldOut = reward.quantity === 0
  const minTier = tiers.find((tier) => tier.id === reward.min_tier_id) ?? null

  return (
    <article className="border-border bg-card grid overflow-hidden rounded-xl border">
      <div className="bg-surface-container relative aspect-[4/3] w-full">
        {reward.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reward.image_url}
            alt=""
            width={480}
            height={360}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground grid size-full place-items-center">
            <Gift className="size-8" aria-hidden />
          </span>
        )}
        <span className="bg-card absolute top-3 right-3 grid justify-items-end rounded-lg px-2 py-1 shadow-soft">
          <span className="text-primary text-label-md font-bold">
            {m.cost(reward.points_cost)}
          </span>
        </span>
        {/* Catalog flags first — they change what the shop does with the row;
            "out of stock" is only a symptom of the quantity below. */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
          {reward.is_featured && (
            <Badge className="bg-warning/20 text-warning gap-1">
              <Flame className="size-3" aria-hidden />
              {m.featuredChip}
            </Badge>
          )}
          {reward.is_exclusive && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="size-3" aria-hidden />
              {m.exclusiveChip}
            </Badge>
          )}
          {soldOut && <Badge variant="destructive">{m.soldOut}</Badge>}
          {minTier && (
            <Badge variant="secondary">{m.minTierChip(minTier.name)}</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-3 p-6">
        <div className="grid gap-1">
          <p className="text-label-md text-muted-foreground uppercase">
            {reward.is_active ? t.common.active : t.common.inactive}
            {reward.category ? ` · ${reward.category}` : ""}
          </p>
          {/* Both are admin free text: the name has to stay legible at two
              lines, the blurb reveals the rest on hover. */}
          <TruncatedText className="text-headline-md">
            {reward.name}
          </TruncatedText>
          {reward.description && (
            <TruncatedText className="text-body-sm text-muted-foreground">
              {reward.description}
            </TruncatedText>
          )}
        </div>

        <div className="grid gap-1.5">
          <p
            className={
              soldOut
                ? "text-destructive text-body-sm"
                : "text-body-sm text-muted-foreground"
            }
          >
            {m.stockOf(reward.quantity, maxQuantity)}
          </p>
          <Progress
            value={maxQuantity === 0 ? 0 : reward.quantity / maxQuantity}
            label={m.quantity}
          />
        </div>

        <div className="flex items-center justify-end gap-1">
          <RewardDialog row={reward} categories={categories} tiers={tiers} />
          <ConfirmDelete
            name={reward.name}
            onConfirm={deleteReward.bind(null, reward.id)}
          />
        </div>
      </div>
    </article>
  )
}
