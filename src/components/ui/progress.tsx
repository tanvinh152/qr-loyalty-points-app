import { cn } from "@/lib/utils"

// Minimal determinate progress bar. Plain markup on purpose — the only consumer
// is the tier gauge on /claim, and it needs no interaction.
export function Progress({
  value,
  className,
  label,
}: {
  /** 0–1 */
  value: number
  className?: string
  label?: string
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cn("bg-secondary h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className="bg-primary h-full rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
