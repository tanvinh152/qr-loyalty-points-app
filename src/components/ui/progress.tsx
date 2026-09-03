import {
  Progress as ProgressPrimitive,
  ProgressIndicator,
} from "@/components/animate-ui/primitives/radix/progress"
import { DUR, EASE } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

// Determinate progress bar. Every consumer is a read-only gauge and none needs
// interaction — but the fill is Motion's now rather than the pure-CSS
// `animate-progress-fill`, so this is a client component where it used to be
// plain server-rendered markup. That is the accepted cost of putting the whole
// ui/ layer on one animation engine; the `@utility` itself stays in globals.css
// because `animate-rail-fill` beside it is still used by the roadmap.
//
// `tone` exists because the bar has to survive three different backgrounds:
// a plain card, a tier-accented panel (where `--tier` is set on a wrapper), and
// the /dashboard hero, whose saturated gradient hides the whole surface ladder.
// On the hero both halves must be drawn from `--hero-*` or the bar disappears.
const TRACK: Record<ProgressTone, string> = {
  default: "bg-surface-container border-border border",
  accent: "bg-surface-container border-border border",
  hero: "bg-hero-ink/25",
}

const FILL: Record<ProgressTone, string> = {
  default: "bg-primary-container",
  accent: "bg-tier",
  hero: "bg-hero-accent",
}

export type ProgressTone = "default" | "accent" | "hero"

export function Progress({
  value,
  className,
  label,
  tone = "default",
}: {
  /** 0–1 */
  value: number
  className?: string
  label?: string
  /**
   * `accent` fills with the surrounding tier colour; `hero` is the only tone
   * legible inside a `bg-hero` surface.
   */
  tone?: ProgressTone
}) {
  // Callers speak 0–1; Radix's Root is scored against `max`, which defaults to
  // 100. Drop this conversion and every bar in the app parks at ~1% — with no
  // type error, because both sides are `number`.
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)

  return (
    <ProgressPrimitive
      value={pct}
      aria-label={label}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full",
        TRACK[tone],
        className,
      )}
    >
      {/* The fill is full-width and slid in from the left rather than scaled,
          so a rounded end cap keeps its shape. `initial` is what makes the bar
          climb from empty on a hard reload instead of appearing already full. */}
      <ProgressIndicator
        className={cn("h-full w-full rounded-full", FILL[tone])}
        initial={{ x: "-100%" }}
        transition={{ duration: DUR.reveal, ease: EASE.outQuart }}
      />
    </ProgressPrimitive>
  )
}
