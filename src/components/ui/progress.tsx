import { cn } from "@/lib/utils"

// Minimal determinate progress bar. Plain markup on purpose — the only consumer
// is the tier gauge on /claim, and it needs no interaction.
export function Progress({
  value,
  className,
  label,
  accent = false,
}: {
  /** 0–1 */
  value: number
  className?: string
  label?: string
  /** Fill with the surrounding tier accent instead of the default blue. */
  accent?: boolean
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
        "bg-surface-container border-border/40 h-2 w-full overflow-hidden rounded-full border",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          accent ? "bg-tier" : "bg-primary-container",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
