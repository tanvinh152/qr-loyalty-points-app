"use client"

import { useTransition } from "react"
import { CircleCheck, Gift, Hourglass, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatVnd } from "@/lib/utils"
import { useT } from "@/lib/i18n/provider"
import { thresholdMagnitude, type MilestoneNode } from "@/lib/milestones"
import { claimMilestone } from "./actions"

// How far a locked rung recedes, by how many locked rungs precede it. Full class
// strings in a lookup because Tailwind cannot see an interpolated one — the same
// reason the dashboard's ENGAGEMENT_SPAN is a table. The ladder stops at four
// steps; everything past that holds at the last one, so a twenty-rung programme
// does not fade its tail to nothing.
const LOCKED_FADE = [
  "opacity-70 grayscale-[50%]",
  "opacity-60 grayscale-[80%]",
  "opacity-50 grayscale",
  "opacity-40 grayscale",
] as const

/**
 * One rung of the ladder: the marker on the rail plus the card beside it.
 *
 * A client component only for the claim button's pending state — the three
 * visual states are decided on the server by `buildRoadmap`, and the action
 * revalidates, so the node re-renders from the database rather than from local
 * state.
 */
export function MilestoneNodeRow({
  node,
  lockedIndex = 0,
}: {
  node: MilestoneNode
  /** Position among the LOCKED rungs, counting from the first one. */
  lockedIndex?: number
}) {
  const t = useT()
  const r = t.customer.roadmap
  const [isPending, startTransition] = useTransition()

  const { milestone, state, award, shortfall } = node
  const { value, unit } = thresholdMagnitude(milestone.spend_threshold ?? 0)

  function handleClaim() {
    startTransition(async () => {
      const res = await claimMilestone(milestone.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(r.claimSuccess(res.result.milestone_name))
    })
  }

  const marker =
    state === "claimed" ? (
      <span className="bg-success/15 border-success text-success grid size-16 place-items-center rounded-full border-2">
        <CircleCheck className="size-7" aria-hidden />
      </span>
    ) : state === "claimable" ? (
      <span className="bg-primary-container text-primary-foreground border-card shadow-elevated animate-milestone-pulse grid size-16 place-items-center rounded-full border-4">
        <Gift className="size-7" aria-hidden />
      </span>
    ) : (
      <span className="bg-surface-container border-border text-muted-foreground grid size-16 place-items-center rounded-full border-2">
        <Lock className="size-6" aria-hidden />
      </span>
    )

  return (
    <li
      className={cn(
        "relative flex items-start gap-4 md:items-center md:gap-6",
        // The mockup lifts the one claimable rung out of the ladder. `z-20`
        // matters as much as the scale: the enlarged card would otherwise slide
        // under its neighbour's border.
        state === "claimable" &&
          "z-20 origin-left transition-transform md:scale-105",
      )}
    >
      {/* The marker sits above the rail, which runs behind it. */}
      <div className="relative z-10 grid shrink-0 justify-items-center gap-2">
        {marker}
        <span
          className={cn(
            "text-label-md bg-background rounded-full px-2 py-0.5 font-bold tabular-nums",
            state === "claimed"
              ? "text-success"
              : state === "claimable"
                ? // Filled, not bare: the mockup gives the live rung's amount a
                  // chip so it reads as part of the highlighted node.
                  "bg-accent text-primary px-3 py-1"
                : "text-muted-foreground",
          )}
        >
          {r.thresholdShort(value, unit)}
        </span>
      </div>

      <div
        className={cn(
          "flex min-w-0 grow flex-col items-start gap-4 rounded-3xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-6",
          state === "claimable"
            ? "border-primary bg-card shadow-elevated relative overflow-hidden border-2"
            : state === "claimed"
              ? "border-border bg-card shadow-soft opacity-80 hover:opacity-100"
              : // Locked rungs recede rather than disappear: the ladder's whole
                // point is showing what is still ahead. They fade progressively
                // so distance down the ladder is legible at a glance.
                cn(
                  "border-border bg-surface-low",
                  LOCKED_FADE[Math.min(lockedIndex, LOCKED_FADE.length - 1)],
                ),
        )}
      >
        {/* The mockup's quarter-disc, on the claimable rung only. */}
        {state === "claimable" && (
          <span
            aria-hidden
            className="bg-primary/5 pointer-events-none absolute top-0 right-0 size-32 rounded-bl-full"
          />
        )}
        <div className="relative flex min-w-0 items-center gap-4">
          {milestone.image_url ? (
            // Admin-entered URLs from any host, so this stays a plain <img>
            // instead of widening next.config remotePatterns to the whole web.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={milestone.image_url}
              alt=""
              width={72}
              height={72}
              loading="lazy"
              className={cn(
                "size-16 shrink-0 rounded-2xl object-cover sm:size-18",
                state === "locked" && "opacity-60",
              )}
            />
          ) : (
            <span className="bg-surface-container text-muted-foreground grid size-16 shrink-0 place-items-center rounded-2xl sm:size-18">
              <Gift className="size-6" aria-hidden />
            </span>
          )}

          <div className="grid min-w-0 gap-1">
            {state === "claimable" && (
              <Badge variant="secondary" className="w-fit">
                {r.newlyUnlocked}
              </Badge>
            )}
            <h3
              className={cn(
                "text-body-lg font-bold",
                state === "locked" && "text-muted-foreground",
              )}
            >
              {milestone.name}
            </h3>
            {milestone.description && (
              <p className="text-body-sm text-muted-foreground">
                {milestone.description}
              </p>
            )}
          </div>
        </div>

        <div className="relative flex shrink-0 flex-wrap items-center gap-2">
          {state === "claimed" ? (
            <>
              {/* One pill carrying the state, as the mockup draws it. */}
              <span className="bg-surface-container text-muted-foreground text-body-sm inline-flex items-center gap-1.5 rounded-md px-4 py-2 font-medium">
                <CircleCheck className="size-4 shrink-0" aria-hidden />
                {r.stateClaimed}
              </span>
              {/* A claimed prize is settled by hand at the counter, so the only
                  way a member learns it is still waiting is being told. */}
              <Badge variant={award?.fulfilled_at ? "muted" : "secondary"}>
                {award?.fulfilled_at ? r.collectedChip : r.pendingChip}
              </Badge>
            </>
          ) : state === "claimable" ? (
            <Button type="button" onClick={handleClaim} disabled={isPending}>
              {isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Gift aria-hidden />
              )}
              {isPending ? r.claiming : r.claimCta}
            </Button>
          ) : (
            <span className="text-body-sm text-muted-foreground inline-flex items-center gap-1.5 tabular-nums">
              <Hourglass className="size-4 shrink-0" aria-hidden />
              {r.shortfall(formatVnd(shortfall))}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}
