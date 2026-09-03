"use client"

import { useCallback, useState, useTransition } from "react"
import { Ban, Coins, FerrisWheel, Gift } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/provider"
import { loadSpinBoard, type SpinBoard } from "./actions"
import { Wheel } from "./wheel"

// The wheel, and the header pill that opens it. It was a route (/spin) until
// 2026-08-31; a member spins for ten seconds and goes back to whatever they
// were doing, and a whole page navigation — with its own back link home — was
// a heavier gesture than the thing it led to.
//
// The pill is the DialogTrigger itself rather than a Link: there is no route
// left to navigate to, so nothing here should look like a destination to a
// middle-click or a "copy link address".
//
// Nothing is read until it opens. The pill sits on every route, so loading the
// wedges and the win list with the layout would put two more queries on every
// page in the portal for a dialog most loads never open. What the layout DOES
// read is only what the badge needs.

const TYPE_ICONS = {
  points: Coins,
  gift: Gift,
  none: Ban,
} as const

export function SpinDialog({
  spinsLeft,
  pendingGifts,
  className,
}: {
  /** Server-rendered, for the badge only — `loadSpinBoard` is the authority
   *  once the dialog opens, and `spin_wheel` once it is clicked. */
  spinsLeft: number
  pendingGifts: number
  className?: string
}) {
  const t = useT()
  const nav = t.customer.nav
  const s = t.customer.spin

  const [open, setOpen] = useState(false)
  const [board, setBoard] = useState<SpinBoard | null>(null)
  const [loading, startLoading] = useTransition()

  const load = useCallback(() => {
    startLoading(async () => setBoard(await loadSpinBoard()))
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Re-read on every open, not once: a wedge can sell out and the day's
        // spins reset at midnight while a tab sits open.
        if (next) load()
      }}
    >
      {/* Icon-only below `md`, where the label would crowd the avatar —
          `sr-only`, NEVER `hidden`, or the button loses its accessible name. */}
      <DialogTrigger
        title={nav.spin}
        className={cn(
          // 32px drawn; the ::before widens the HIT box to 44px without moving
          // anything, which is the touch minimum this pill sat under.
          "bg-surface-high text-label-md text-primary hover:bg-surface-highest group relative inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-colors before:absolute before:-inset-1.5 before:content-[''] md:w-auto md:px-3",
          className,
        )}
      >
        <FerrisWheel
          className="duration-slow ease-out-quart size-4 shrink-0 transition-transform group-hover:rotate-45"
          aria-hidden
        />
        <span className="max-md:sr-only">{nav.spin}</span>
        {/* A gift won on the wheel is settled by hand at the counter, so the
            only way a member learns one is waiting is being told. The dot says
            that to a sighted reader; the sr-only line is its equivalent. */}
        {(pendingGifts > 0 || spinsLeft > 0) && (
          <>
            <span
              aria-hidden
              className="bg-warning ring-sidebar animate-pulse-dot absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2"
            />
            <span className="sr-only">
              {pendingGifts > 0
                ? nav.spinPending(pendingGifts)
                : nav.spinLeft(spinsLeft)}
            </span>
          </>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>{s.subtitle}</DialogDescription>
        </DialogHeader>

        {/* The skeleton is for the FIRST open only — `loading` deliberately
            does not gate this. `onSettled` re-runs the same load once a spin
            has stopped, and swapping the wheel out then would take away the
            result panel the member is still reading. A reopen shows the
            previous board until the new one lands, for the same reason.
            It is wheel-SHAPED — the same max-w-sm disc, the pill and the
            result floor `Wheel` draws — so the real board lands on top of it
            without the dialog resizing under the pointer. */}
        {!board ? (
          <div
            className="grid justify-items-center gap-6"
            role="status"
            aria-label={s.title}
            aria-busy={loading}
          >
            <div className="bg-surface-container aspect-square w-full max-w-sm animate-pulse rounded-full" />
            <div className="grid min-h-44 w-full place-items-center">
              <div className="bg-surface-container h-11 w-44 animate-pulse rounded-full" />
            </div>
          </div>
        ) : !board.ok ? (
          <EmptyState
            icon={board.reason === "off" ? FerrisWheel : Ban}
            title={board.reason === "off" ? s.offTitle : s.title}
            description={board.error}
          />
        ) : (
          <>
            <Wheel
              slices={board.slices}
              initialSpinsLeft={board.spinsLeft}
              onSettled={load}
            />

            <section className="grid gap-2">
              <h3 className="text-label-lg font-semibold">{s.historyTitle}</h3>
              {board.history.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">
                  {s.historyEmpty}
                </p>
              ) : (
                <ul className="divide-border border-border divide-y rounded-2xl border">
                  {board.history.map((win) => {
                    const Icon = TYPE_ICONS[win.prize_type]
                    return (
                      <li
                        key={win.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "bg-surface-container grid size-8 shrink-0 place-items-center rounded-lg",
                              win.prize_type === "none"
                                ? "text-muted-foreground"
                                : "text-primary",
                            )}
                          >
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="text-body-sm truncate">
                              {win.prize_type === "none"
                                ? s.noPrizeLabel
                                : win.prize_name}
                            </p>
                            <p className="text-body-sm text-muted-foreground">
                              {win.wonAt}
                            </p>
                          </div>
                        </div>
                        {win.prize_type === "points" && (
                          <Badge variant="secondary">
                            {s.pointsChip(win.points_awarded)}
                          </Badge>
                        )}
                        {/* Only a gift is settled by hand, so only a gift can
                            be waiting at the counter. */}
                        {win.prize_type === "gift" && (
                          <Badge
                            variant={win.collected ? "success" : "warning"}
                          >
                            {win.collected ? s.collectedChip : s.pendingChip}
                          </Badge>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
