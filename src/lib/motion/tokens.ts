// The JS half of the motion system. Mirrors the non-inline `@theme` block in
// src/app/globals.css — the two must stay in sync, the same obligation the two
// dark-theme selectors in that file already carry. CSS owns everything that can
// be a class; this file exists for the handful of animations that are driven
// imperatively by Motion (the wheel, the points pill, presence swaps), because
// those cannot read a Tailwind utility.
//
// A folder rather than a bare motion.ts, matching src/lib/theme/* and
// src/lib/i18n/*. No `server-only`: every consumer is a client component.

/** Seconds, because that is what Motion takes. Milliseconds in globals.css. */
export const DUR = {
  instant: 0.1,
  quick: 0.18,
  base: 0.24,
  slow: 0.42,
  reveal: 0.7,
} as const

/** Cubic-bezier control points, identical to the --ease-* custom properties. */
export const EASE = {
  outQuart: [0.25, 1, 0.5, 1],
  outExpo: [0.16, 1, 0.3, 1],
  backOut: [0.34, 1.56, 0.64, 1],
  inQuart: [0.5, 0, 0.75, 0],
} as const

/** Ready-made Motion transitions. `pop` is the one spring in the system. */
export const T = {
  quick: { duration: DUR.quick, ease: EASE.outQuart },
  base: { duration: DUR.base, ease: EASE.outQuart },
  exit: { duration: DUR.quick, ease: EASE.inQuart },
  pop: { type: "spring", stiffness: 420, damping: 26, mass: 0.8 },
  count: { duration: 0.6, ease: EASE.outQuart },
} as const

/** The wheel's throw. A single-site constant, deliberately NOT a design token —
 *  4.2s is the length of one spin, not a scale step anything else may reuse. */
export const SPIN_MS = 4200

/** Points pill count-up. Long enough to read as a tally, short enough that a
 *  route change never catches it mid-flight. */
export const COUNT_MS = 600

/** Entrance stagger, as FULL class strings. Tailwind cannot see an interpolated
 *  class (`delay-${i}` compiles to nothing), which is the same reason
 *  ENGAGEMENT_SPAN in dashboard/page.tsx and LOCKED_FADE in milestone-node.tsx
 *  are lookups rather than templates. Every value here ships in tw-animate-css.
 *  Callers must clamp: STAGGER[Math.min(i, STAGGER.length - 1)]. */
export const STAGGER = [
  "delay-0",
  "delay-75",
  "delay-150",
  "delay-200",
  "delay-300",
  "delay-500",
] as const
