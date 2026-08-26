"use client"

import { useState, useTransition } from "react"
import { Flame, Gift, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/provider"
import type { MembershipTierRow, RewardRow } from "@/lib/db-types"
import { LOW_STOCK } from "@/lib/rewards"
import { redeemReward } from "./actions"

export function RewardCard({
  reward,
  currentPoints,
  lockedFor = null,
  variant = "card",
  className,
}: {
  reward: RewardRow
  currentPoints: number
  /** Set when the customer's tier is below reward.min_tier_id — the tier they need. */
  lockedFor?: MembershipTierRow | null
  /** `bare` drops the frame and image — the shop hero supplies its own.
   * `row` is the dashboard's list line: a 56px thumb instead of a 192px cover,
   * so three of them fit a 6-column bento tile beside the orders table.
   * `feature` is the dashboard's 4-column tile: icon-led rather than image-led,
   * with the CTA as a full-width plate at the bottom. It IS the tile — no
   * SectionCard wraps it — so it carries its own panel treatment. */
  variant?: "card" | "row" | "bare" | "feature"
  /** Grid placement from the caller; the bento columns live on the page. */
  className?: string
}) {
  const t = useT()
  const r = t.customer.rewards
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const outOfStock = reward.quantity <= 0
  // The mockup's "running low" chip. Same threshold the admin list uses for its
  // low-stock stat, kept as a literal here so the card needs no extra query.
  const lowStock = !outOfStock && reward.quantity <= LOW_STOCK
  const tooExpensive = currentPoints < reward.points_cost
  const tierLocked = lockedFor !== null
  // The server re-checks all three — this only avoids an obviously doomed round trip.
  const disabled = outOfStock || tooExpensive || tierLocked || isPending

  function handleRedeem() {
    startTransition(async () => {
      const res = await redeemReward(reward.id)
      setOpen(false)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(r.success(res.rewardName))
    })
  }

  const price = (
    <div className="grid gap-0.5">
      <span className="text-headline-md text-primary tabular-nums">
        {r.cost(reward.points_cost)}
      </span>
    </div>
  )

  const action = (
    // Redeeming spends points irreversibly, so it goes through a
    // confirmation dialog.
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            // The mockup's list line carries an OUTLINED "Đổi" — the row already
            // sits inside a card whose own CTA is elsewhere, and a solid button
            // per row turns the list into a wall of blue. The feature tile and
            // the shop card both keep the solid one: there the button IS the
            // card's action.
            variant={variant === "row" ? "secondary" : "default"}
            size={variant === "feature" ? "lg" : "sm"}
            disabled={disabled}
          />
        }
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {isPending
          ? r.redeeming
          : tierLocked
            ? r.tierRequired(lockedFor.name)
            : tooExpensive
              ? r.notEnough
              : r.redeem}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{r.redeem}</AlertDialogTitle>
          <AlertDialogDescription>
            {r.confirm(reward.name, reward.points_cost)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleRedeem} disabled={isPending}>
            {isPending ? r.redeeming : r.redeem}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (variant === "bare") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        {price}
        {action}
      </div>
    )
  }

  // One chip per card, most urgent first — the mockup never stacks two.
  const chip = reward.is_featured ? (
    // Red, per the mockup's "HOT". Amber reads as a warning here, and the one
    // actual warning state on this card (low stock) is already amber-adjacent.
    <Badge variant="destructive" className="gap-1">
      <Flame className="size-3" aria-hidden />
      {r.hotChip}
    </Badge>
  ) : reward.is_exclusive ? (
    <Badge variant="secondary" className="gap-1">
      <Sparkles className="size-3" aria-hidden />
      {r.exclusiveChip}
    </Badge>
  ) : tierLocked ? (
    <Badge variant="muted">{r.tierRequired(lockedFor.name)}</Badge>
  ) : outOfStock ? (
    <Badge variant="muted">{r.outOfStock}</Badge>
  ) : lowStock ? (
    <Badge variant="warning">{r.lowStock}</Badge>
  ) : null

  if (variant === "feature") {
    return (
      <div
        className={cn(
          "bg-card shadow-soft relative flex flex-col gap-4 overflow-hidden rounded-3xl p-6",
          className,
        )}
      >
        {/* The mockup's quarter-disc bleeding out of the top-right corner. */}
        <span
          aria-hidden
          className="bg-primary-container/15 pointer-events-none absolute -top-8 -right-8 size-32 rounded-bl-full"
        />
        <div className="relative flex items-start justify-between gap-3">
          {reward.image_url ? (
            // Admin-entered URLs from any host — see the card variant below.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reward.image_url}
              alt=""
              width={56}
              height={56}
              className="size-14 shrink-0 rounded-2xl object-cover"
              loading="lazy"
            />
          ) : (
            <span className="bg-surface-container text-primary grid size-14 shrink-0 place-items-center rounded-2xl">
              <Gift className="size-6" aria-hidden />
            </span>
          )}
          {chip}
        </div>

        <div className="relative mt-auto grid gap-1">
          <h3 className="text-body-lg font-bold">{reward.name}</h3>
          <span className="text-headline-md text-primary tabular-nums">
            {r.cost(reward.points_cost)}
          </span>
        </div>

        {/* Full-width plate, per the mockup. `[&>*]:w-full` rather than a prop
            on RewardCard: `action` is one shared node used by three variants and
            only this one wants the button to stretch. */}
        <div className="relative [&>*]:w-full">{action}</div>
      </div>
    )
  }

  if (variant === "row") {
    return (
      <div
        className={cn(
          "hover:bg-surface-low flex items-center gap-4 rounded-2xl border border-transparent p-3 transition-colors",
          className,
        )}
      >
        {reward.image_url ? (
          // Same reasoning as the card: admin-entered URLs from any host.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reward.image_url}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-xl object-cover"
            loading="lazy"
          />
        ) : (
          <div className="bg-surface-container text-muted-foreground grid size-14 shrink-0 place-items-center rounded-xl">
            <Gift className="size-5" aria-hidden />
          </div>
        )}

        <div className="min-w-0 grow">
          <h3 className="truncate font-semibold">{reward.name}</h3>
          <p className="text-body-sm text-primary font-semibold tabular-nums">
            {r.cost(reward.points_cost)}
          </p>
        </div>

        {/* The chip is the first thing to go: at 390px the row has to fit a
            name, a price and the redeem button, and the button is the point. */}
        {chip && <div className="max-sm:hidden">{chip}</div>}
        {action}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "border-border bg-card group flex flex-col overflow-hidden rounded-3xl border",
        className,
      )}
    >
      <div className="relative">
        {reward.image_url ? (
          // Admin-entered URLs from any host, so this stays a plain <img> instead
          // of widening next.config remotePatterns to the whole web.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reward.image_url}
            alt=""
            width={480}
            height={192}
            className="h-48 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="bg-surface-container text-muted-foreground grid h-48 place-items-center">
            <Gift className="size-10" aria-hidden />
          </div>
        )}
        {chip && <div className="absolute top-3 right-3">{chip}</div>}

        {/* The redeem control lives over the image and fades in on hover. It
            stays in the DOM and in the tab order, so focus-within has to reveal
            it too or keyboard users would be operating an invisible button.
            A touch screen never hovers, so there it drops the scrim and parks
            the button in the corner permanently — otherwise the only way to
            redeem on a phone is to tab to an invisible target. */}
        <div className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:inset-auto pointer-coarse:right-3 pointer-coarse:bottom-3 pointer-coarse:bg-transparent pointer-coarse:opacity-100">
          {action}
        </div>
      </div>

      <div className="flex grow flex-col gap-2 p-4">
        <h3 className="text-label-md tracking-wide uppercase">{reward.name}</h3>

        <div className="border-border mt-auto border-t pt-3">{price}</div>
      </div>
    </div>
  )
}
