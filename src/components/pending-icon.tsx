"use client"

import { AnimatePresence, m } from "motion/react"
import { Loader2 } from "lucide-react"

import { T } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

/**
 * The spinner-swap every pending button in the app was doing by hand, as a
 * cross-fade instead of a hard cut. Seven call sites.
 *
 * `m.span`, not `motion.span`: MotionProvider mounts LazyMotion in `strict`
 * mode, where the full `motion` namespace throws.
 *
 * The Loader2 keeps `animate-spin`, which the app-wide reduced-motion rule in
 * globals.css deliberately exempts — a frozen spinner reads as a hung request.
 */
export function PendingIcon({
  pending,
  children,
  className,
}: {
  pending: boolean
  /** The icon shown when idle. */
  children: React.ReactNode
  /** Sizing for both states — they must match or the button width jumps. */
  className?: string
}) {
  return (
    // A fixed-size grid with both states stacked in cell 1/1: `mode="wait"`
    // would collapse the box between the two icons and jog the button's label.
    <span
      aria-hidden
      className={cn("relative grid shrink-0 place-items-center", className)}
    >
      <AnimatePresence initial={false}>
        <m.span
          key={pending ? "pending" : "idle"}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={T.quick}
          className="col-start-1 row-start-1 grid place-items-center"
        >
          {pending ? (
            <Loader2 className={cn("animate-spin", className)} />
          ) : (
            children
          )}
        </m.span>
      </AnimatePresence>
    </span>
  )
}
