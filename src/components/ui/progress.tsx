import { cn } from "@/lib/utils"

// Minimal determinate progress bar. Plain markup on purpose — every consumer is
// a read-only gauge and none needs interaction.
//
// `tone` exists because the bar has to survive three different backgrounds:
// a plain card, a tier-accented panel (where `--tier` is set on a wrapper), and
// the /dashboard hero, whose saturated gradient hides the whole surface ladder.
// On the hero both halves must be drawn from `--hero-*` or the bar disappears.
const TRACK: Record<ProgressTone, string> = {
  default: "bg-surface-container border-border/40 border",
  accent: "bg-surface-container border-border/40 border",
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
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full",
        TRACK[tone],
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", FILL[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
