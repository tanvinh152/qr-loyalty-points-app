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
import type { RewardRow } from "@/lib/db-types"
import { LOW_STOCK } from "@/lib/rewards"
import { redeemReward } from "./actions"

export function RewardCard({
  reward,
  currentPoints,
  variant = "card",
  className,
}: {
  reward: RewardRow
  currentPoints: number
  /** `bare` drops the frame and image — the shop hero supplies its own. */
  variant?: "card" | "bare"
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
  // The server re-checks both — this only avoids an obviously doomed round trip.
  const disabled = outOfStock || tooExpensive || isPending
  const discounted =
    reward.original_points_cost != null &&
    reward.original_points_cost > reward.points_cost

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
      {discounted && (
        <span className="text-body-xs text-muted-foreground tabular-nums line-through">
          {r.wasCost(reward.original_points_cost!)}
        </span>
      )}
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
        render={<Button type="button" size="sm" disabled={disabled} />}
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {isPending ? r.redeeming : tooExpensive ? r.notEnough : r.redeem}
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
    <Badge className="bg-warning/20 text-warning gap-1">
      <Flame className="size-3" aria-hidden />
      {r.hotChip}
    </Badge>
  ) : reward.is_exclusive ? (
    <Badge variant="secondary" className="gap-1">
      <Sparkles className="size-3" aria-hidden />
      {r.exclusiveChip}
    </Badge>
  ) : outOfStock ? (
    <Badge variant="muted">{r.outOfStock}</Badge>
  ) : lowStock ? (
    <Badge className="bg-destructive/20 text-destructive">{r.lowStock}</Badge>
  ) : null

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
            it too or keyboard users would be operating an invisible button. */}
        <div className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
