"use client"

import { useState } from "react"
import { m } from "motion/react"

import { DUR, EASE, T } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

/**
 * The one-shot burst a win or a claim earns: the `animate-claim-burst` halo
 * the roadmap already plays, six sparks thrown outward, and a pop on the glyph
 * itself. Check-in, redeem and the wheel all had a toast and nothing else.
 *
 * This is the whole celebration — there is no confetti canvas, on purpose. A
 * burst that sits ON the thing that just happened points at it; confetti over
 * the page points at nothing.
 *
 * `T.pop` and the `--ease-back-out` overshoot behind it are allowed here and
 * nowhere new: AGENTS.md scopes the overshoot to win and claim confirmations,
 * and every caller of this component is one. It is safe for the same reason
 * the roadmap's burst is — every caller fires it AFTER the server has
 * confirmed, and none of those writes is ever retracted, so it can never be
 * seen running backwards. Do not fire it optimistically.
 *
 * `fire` is edge-triggered: each false→true flip plays one burst, keyed by a
 * counter so a second flip replays even if the first has not been cleared. All
 * decorative nodes are `aria-hidden`; the caller keeps its own `role="status"`
 * copy, which is what a screen reader hears.
 *
 * Reduced motion needs no code here: MotionConfig `reducedMotion="user"`
 * freezes the Motion parts and the app-wide rule in globals.css collapses the
 * CSS halo to 1ms.
 */
const SPARKS = 6
const SPARK_RADIUS = 24

export function Celebration({
  fire,
  tone = "success",
  children,
  className,
}: {
  fire: boolean
  /** `warning` for a gift that still has to be collected at the counter. */
  tone?: "success" | "warning"
  /** The glyph being celebrated — sized by the caller, as every icon is. */
  children: React.ReactNode
  className?: string
}) {
  const [burst, setBurst] = useState(0)
  // Edge detection during render rather than in an effect — the React-endorsed
  // shape, and the one `react-hooks/set-state-in-effect` allows.
  const [seenFire, setSeenFire] = useState(fire)
  if (fire !== seenFire) {
    setSeenFire(fire)
    if (fire) setBurst((n) => n + 1)
  }

  const color = tone === "warning" ? "bg-warning" : "bg-success"

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center",
        className,
      )}
    >
      {burst > 0 && (
        <span
          key={burst}
          data-slot="celebration-burst"
          aria-hidden
          className="pointer-events-none absolute inset-0"
          onAnimationEnd={() => setBurst(0)}
        >
          <span
            className="animate-claim-burst absolute inset-0 rounded-full"
            style={
              tone === "warning"
                ? {
                    // The utility draws from --success; a gift is amber.
                    ["--pulse-color" as string]:
                      "color-mix(in srgb, var(--warning) 45%, transparent)",
                  }
                : undefined
            }
          />
          {Array.from({ length: SPARKS }, (_, i) => {
            const angle = (i / SPARKS) * Math.PI * 2
            return (
              <m.span
                key={i}
                className={cn(
                  "absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                  color,
                )}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(angle) * SPARK_RADIUS,
                  y: Math.sin(angle) * SPARK_RADIUS,
                  scale: 1,
                  opacity: 0,
                }}
                transition={{ duration: DUR.slow, ease: EASE.outQuart }}
              />
            )
          })}
        </span>
      )}
      <m.span
        key={burst}
        className="col-start-1 row-start-1 grid place-items-center"
        animate={burst > 0 ? { scale: [1, 1.15, 1] } : undefined}
        transition={T.pop}
      >
        {children}
      </m.span>
    </span>
  )
}
