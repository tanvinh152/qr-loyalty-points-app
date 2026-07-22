/**
 * Circular tier gauge from the member mockups. Plain SVG so it stays a server
 * component; the stroke reads `--tier` from the accent wrapper, so the ring
 * never has to know which tier it is drawing.
 */
export function TierRing({
  /** 0–100. */
  percent,
  label,
  caption,
  size = 192,
}: {
  percent: number
  /** Big readout in the middle — "LV.2" or "MAX". */
  label: string
  /** Small line under it — the tier name or "LEVEL". */
  caption: string
  size?: number
}) {
  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-high"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="stroke-tier"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-headline-lg text-tier leading-none">{label}</span>
        <span className="text-label-md text-muted-foreground mt-1 uppercase">
          {caption}
        </span>
      </div>
    </div>
  )
}
