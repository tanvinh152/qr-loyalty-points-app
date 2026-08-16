import { Ban, Coins, Gift } from "lucide-react"

import { ConfirmDelete } from "@/components/confirm-delete"
import { TruncatedText } from "@/components/truncated-text"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getMessages } from "@/lib/i18n/server"
import type { RewardRow } from "@/lib/db-types"
import { formatOdds, isDrawable } from "@/lib/spin"
import { SpinPrizeDialog } from "./spin-prize-form"
import { deleteSpinPrize } from "./actions"

const TYPE_ICONS = {
  points: Coins,
  gift: Gift,
  none: Ban,
} as const

/**
 * One wedge in the admin grid. The headline figure is the ODDS, not the weight:
 * a weight only means anything against the total, and reading "12 of 75" off a
 * grid of cards is exactly the arithmetic the admin should not have to do.
 *
 * The image URL is admin-supplied and may point anywhere, so this stays a plain
 * `<img>` — `next/image` would need every possible host in `remotePatterns`.
 */
export async function SpinPrizeCard({
  prize,
  totalWeight,
}: {
  /** A `kind = 'spin'` reward row. */
  prize: RewardRow
  /** Sum of the weights of every drawable slice — the odds denominator. */
  totalWeight: number
}) {
  const t = await getMessages()
  const m = t.admin.rewards.spin
  const Icon = TYPE_ICONS[prize.prize_type]
  // An inactive slice, a weightless one, and a sold-out gift are all off the
  // wheel, so none of them has odds to show. `isDrawable` is shared with the
  // page's denominator so the card and the RPC cannot disagree.
  const drawable = isDrawable(prize) && totalWeight > 0
  const share = drawable ? prize.weight / totalWeight : 0
  const soldOut = prize.prize_type === "gift" && prize.quantity <= 0

  const typeLabel =
    prize.prize_type === "points"
      ? m.typePoints
      : prize.prize_type === "gift"
        ? m.typeGift
        : m.typeNone

  return (
    <article className="border-border bg-card grid overflow-hidden rounded-xl border">
      <div className="bg-surface-container relative aspect-[4/3] w-full">
        {prize.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prize.image_url}
            alt=""
            width={480}
            height={360}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground grid size-full place-items-center">
            <Icon className="size-8" aria-hidden />
          </span>
        )}
        <span className="bg-card absolute top-3 right-3 rounded-md px-2 py-1 shadow-[0_4px_6px_-1px_rgba(0,0,0,.05)]">
          <span className="text-primary text-label-md font-bold">
            {drawable ? m.odds(formatOdds(share)) : m.neverDrawn}
          </span>
        </span>
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {prize.prize_type === "points" && prize.points_amount > 0 && (
            <Badge variant="secondary">{m.pointsChip(prize.points_amount)}</Badge>
          )}
          {soldOut && <Badge variant="destructive">{m.outOfStock}</Badge>}
        </div>
      </div>

      <div className="grid gap-3 p-6">
        <div className="grid gap-1">
          <p className="text-label-md text-muted-foreground uppercase">
            {prize.is_active ? t.common.active : t.common.inactive}
            {` · ${typeLabel}`}
          </p>
          <TruncatedText className="text-headline-md">{prize.name}</TruncatedText>
        </div>

        <div className="grid gap-1.5">
          <p className="text-body-sm text-muted-foreground">
            {`${m.weight}: ${prize.weight} · ${m.sortOrder}: ${prize.sort_order}`}
          </p>
          {/* Only a gift is stocked — showing "0 left" on a points wedge would
              read as sold out when it is drawn without limit. */}
          {prize.prize_type === "gift" && (
            <p
              className={`text-body-sm ${soldOut ? "text-destructive" : "text-muted-foreground"}`}
            >
              {`${m.quantity}: ${prize.quantity}`}
            </p>
          )}
          <Progress value={share} label={m.weight} />
        </div>

        <div className="flex items-center justify-end gap-1">
          <SpinPrizeDialog row={prize} />
          <ConfirmDelete
            name={prize.name}
            onConfirm={deleteSpinPrize.bind(null, prize.id)}
          />
        </div>
      </div>
    </article>
  )
}
