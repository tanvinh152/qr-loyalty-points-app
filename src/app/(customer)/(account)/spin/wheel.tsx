"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Coins, Gift, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/provider"
import type { SpinPrizeType, SpinResult } from "@/lib/db-types"
import { spin } from "./actions"

/** The wedge data the wheel needs — a plain object, not a `RewardRow`: only
 *  serialisable values cross the server -> client boundary. */
export type WheelSlice = {
  id: string
  name: string
  prize_type: SpinPrizeType
}

const TYPE_ICONS = {
  points: Coins,
  gift: Gift,
  none: Ban,
} as const

/** Full turns added on top of the alignment, so the wheel reads as a spin. */
const TURNS = 6
const DURATION_MS = 4200
/** Geometry only — the SVG scales to its box, so this is not a pixel size. */
const R = 100
/** Where a wedge's label sits, as a share of the radius. */
const LABEL_R = 0.66

// Five categorical tokens, cycled. Every colour on this page is a token: the
// palette has to survive both themes, and a literal hex would only be correct
// in one of them.
const FILLS = [
  "fill-chart-1/20",
  "fill-chart-2/20",
  "fill-chart-3/20",
  "fill-chart-4/20",
  "fill-chart-5/20",
] as const

function polar(angleDeg: number, radius: number) {
  // -90 puts angle 0 at twelve o'clock, where the pointer is.
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) }
}

/** Roughly what fits across a wedge at `LABEL_R`, in characters. */
const MAX_CHARS = 14
const MAX_LINES = 2

/**
 * A wedge name broken onto at most two lines at a word boundary. A wedge is a
 * fixed slice of a circle, so a name that does not fit has to break somewhere —
 * mid-word is the one place it must not, and "Chúc bạn may mắn lần sau" is the
 * ordinary case here rather than the exception.
 */
function wedgeLines(name: string): string[] {
  const lines: string[] = []
  let line = ""

  for (const word of name.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= MAX_CHARS) {
      line = next
    } else if (lines.length < MAX_LINES - 1) {
      if (line) lines.push(line)
      // A single word longer than a line has no boundary to break on.
      line = word.length > MAX_CHARS ? `${word.slice(0, MAX_CHARS - 1)}…` : word
    } else {
      // Last line, out of room: the ellipsis is what says the rest was cut.
      line = `${next.slice(0, MAX_CHARS - 1)}…`
      break
    }
  }

  if (line) lines.push(line)
  return lines
}

/** The pie slice for wedge `index`, as an SVG path centred on (0,0). */
function wedgePath(index: number, step: number) {
  // A single-slice wheel has no arc to draw — two identical endpoints collapse
  // the path, so the whole disc is drawn as a circle instead.
  const a0 = index * step
  const a1 = a0 + step
  const p0 = polar(a0, R)
  const p1 = polar(a1, R)
  const largeArc = step > 180 ? 1 : 0
  return `M 0 0 L ${p0.x} ${p0.y} A ${R} ${R} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`
}

/**
 * The lucky wheel.
 *
 * The server has already decided: `spin()` returns the winning slice, and this
 * only rotates so that slice comes to rest under the pointer. Nothing here
 * influences the outcome — that is the whole reason the draw lives in the RPC.
 */
export function Wheel({
  slices,
  initialSpinsLeft,
}: {
  /** Drawable wedges, in the same order the RPC walks them. */
  slices: WheelSlice[]
  initialSpinsLeft: number
}) {
  const t = useT()
  const s = t.customer.spin
  const router = useRouter()

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [spinsLeft, setSpinsLeft] = useState(initialSpinsLeft)
  const [result, setResult] = useState<SpinResult | null>(null)
  const [isPending, startTransition] = useTransition()
  // Cleared on unmount so a spin still in flight cannot set state afterwards —
  // navigating away mid-animation is the ordinary case, not an edge one.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const step = 360 / slices.length
  const busy = spinning || isPending
  const canSpin = spinsLeft > 0 && !busy

  function handleSpin() {
    startTransition(async () => {
      const res = await spin()
      if (!res.ok) {
        // The RPC's count is the authority: if it says the day is used up, the
        // button has to agree even though this page rendered otherwise.
        if (res.code === "no_spins_left") setSpinsLeft(0)
        toast.error(res.error)
        return
      }

      const won = res.result
      const index = slices.findIndex((slice) => slice.id === won.prize_id)

      // Bring wedge `index` to twelve o'clock: the final rotation has to be
      // ≡ -(mid-angle) mod 360, on top of whole extra turns. A prize that is
      // not on this wheel (a slice went drawable after the page rendered) just
      // spins without alignment rather than stopping on the wrong wedge.
      const mid = index * step + step / 2
      const align = (((-(rotation + mid) % 360) + 360) % 360)
      const target =
        index < 0 ? rotation + TURNS * 360 : rotation + TURNS * 360 + align

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const duration = reduced ? 0 : DURATION_MS

      setSpinning(true)
      setRotation(target)
      // A timeout rather than `transitionend`: at duration 0 the transition
      // never fires an event, and the result must still be shown.
      timer.current = setTimeout(() => {
        setSpinning(false)
        setSpinsLeft(won.spins_left)
        setResult(won)
        // Now that nothing is animating, let the server re-render the history
        // list and the spins-left chip below.
        router.refresh()
      }, duration)
    })
  }

  const ResultIcon = result ? TYPE_ICONS[result.prize_type] : Sparkles

  return (
    <div className="grid justify-items-center gap-6">
      <div className="relative w-full max-w-sm">
        {/* The pointer belongs to the frame, not the disc — it must not turn
            with it. */}
        <span
          aria-hidden
          className="border-t-primary absolute top-0 left-1/2 z-10 -translate-x-1/2 border-x-8 border-t-[14px] border-x-transparent"
        />

        <div className="border-border bg-card rounded-full border-4 p-2">
          <svg
            viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`}
            role="img"
            aria-label={s.wheelLabel}
            className="block size-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? `transform ${DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
                : undefined,
            }}
          >
            {slices.map((slice, index) => {
              const mid = index * step + step / 2
              const label = polar(mid, R * LABEL_R)
              const lines = wedgeLines(slice.name)
              return (
                <g key={slice.id}>
                  {slices.length === 1 ? (
                    <circle
                      r={R}
                      className={cn(FILLS[0], "stroke-border")}
                      strokeWidth={1}
                    />
                  ) : (
                    <path
                      d={wedgePath(index, step)}
                      className={cn(
                        FILLS[index % FILLS.length],
                        "stroke-border",
                      )}
                      strokeWidth={1}
                    />
                  )}
                  {/* Rotated to sit along its own radius, so a long name runs
                      outward instead of across its neighbours. */}
                  <text
                    x={label.x}
                    y={label.y}
                    transform={`rotate(${mid} ${label.x} ${label.y})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground text-[9px] font-semibold"
                  >
                    {lines.map((text, line) => (
                      <tspan
                        key={text}
                        x={label.x}
                        // The first line lifts by half the block's height so
                        // the pair stays centred on the label point.
                        dy={
                          line === 0 ? `${-(lines.length - 1) * 0.5}em` : "1em"
                        }
                      >
                        {text}
                      </tspan>
                    ))}
                  </text>
                </g>
              )
            })}
            {/* Hub, drawn last so it sits over every wedge's point. */}
            <circle r={R * 0.16} className="fill-card stroke-border" />
          </svg>
        </div>

        {/* The animation says nothing to a screen reader, so the wedges are
            also listed in the order they sit on the wheel. */}
        <ul className="sr-only">
          {slices.map((slice, index) => (
            <li key={slice.id}>
              {s.wheelSlice(slice.name, index + 1, slices.length)}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid justify-items-center gap-2">
        <Button
          type="button"
          size="lg"
          onClick={handleSpin}
          disabled={!canSpin}
          className="min-w-44 rounded-full"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-5" aria-hidden />
          )}
          {busy ? s.spinning : spinsLeft > 0 ? s.spin : s.noSpinsLeft}
        </Button>
        <p className="text-body-sm text-muted-foreground">
          {spinsLeft > 0 ? s.spinsLeft(spinsLeft) : s.spinsLeftHint}
        </p>
      </div>

      <Dialog
        open={result !== null}
        onOpenChange={(open) => {
          if (!open) setResult(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <span
              className={cn(
                "mb-2 grid size-14 place-items-center rounded-full",
                result?.prize_type === "none"
                  ? "bg-surface-container text-muted-foreground"
                  : "bg-primary-container/20 text-primary",
              )}
            >
              <ResultIcon className="size-7" aria-hidden />
            </span>
            <DialogTitle>
              {/* "You won!" over a blank wedge would be a taunt. */}
              {result?.prize_type === "none" ? s.noPrizeLabel : s.resultTitle}
            </DialogTitle>
            <DialogDescription className="grid gap-2">
              {result?.prize_type !== "none" && (
                <span className="text-headline-md text-foreground block">
                  {result?.prize_name}
                </span>
              )}
              <span className="block">
                {result?.prize_type === "points"
                  ? s.resultPoints(result.points_awarded)
                  : result?.prize_type === "gift"
                    ? s.resultGift
                    : spinsLeft > 0
                      ? s.resultNone
                      : s.resultNoneDone}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button className="w-full" />}>
              {s.resultClose}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
