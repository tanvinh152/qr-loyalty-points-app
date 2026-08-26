import { Gift } from "lucide-react"

import { ConfirmDelete } from "@/components/confirm-delete"
import { TruncatedText } from "@/components/truncated-text"
import { Badge } from "@/components/ui/badge"
import { formatVnd } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/server"
import type { RewardRow } from "@/lib/db-types"
import { MilestoneDialog } from "./milestone-form"
import { deleteMilestone } from "./actions"

/**
 * One rung in the admin grid. The headline figure is the SPEND THRESHOLD in
 * đồng — the only number that decides anything about this row — and the claim
 * count beside it is what tells the admin whether the rung is live in practice.
 *
 * The image URL is admin-supplied and may point anywhere, so this stays a plain
 * `<img>` — `next/image` would need every possible host in `remotePatterns`.
 */
export async function MilestoneCard({
  milestone,
  claims,
}: {
  /** A `kind = 'milestone'` reward row. */
  milestone: RewardRow
  /** How many members have claimed this rung, all time. */
  claims: number
}) {
  const t = await getMessages()
  const m = t.admin.rewards.milestone

  return (
    <article className="border-border bg-card grid overflow-hidden rounded-xl border">
      <div className="bg-surface-container relative aspect-[4/3] w-full">
        {milestone.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={milestone.image_url}
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
        <span className="bg-card shadow-soft absolute top-3 right-3 rounded-lg px-2 py-1">
          <span className="text-primary text-label-md font-bold tabular-nums">
            {formatVnd(milestone.spend_threshold ?? 0)}
          </span>
        </span>
        {claims > 0 && (
          <div className="absolute top-3 left-3">
            <Badge variant="secondary">{`${m.statClaimed}: ${claims}`}</Badge>
          </div>
        )}
      </div>

      <div className="grid gap-3 p-6">
        <div className="grid gap-1">
          <p className="text-label-md text-muted-foreground uppercase">
            {milestone.is_active ? t.common.active : t.common.inactive}
          </p>
          <TruncatedText className="text-headline-md">
            {milestone.name}
          </TruncatedText>
          {milestone.description && (
            <TruncatedText className="text-body-sm text-muted-foreground">
              {milestone.description}
            </TruncatedText>
          )}
        </div>

        <div className="flex items-center justify-end gap-1">
          <MilestoneDialog row={milestone} />
          <ConfirmDelete
            name={milestone.name}
            onConfirm={deleteMilestone.bind(null, milestone.id)}
          />
        </div>
      </div>
    </article>
  )
}
