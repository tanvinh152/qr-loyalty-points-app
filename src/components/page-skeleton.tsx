/**
 * The shell every list screen resolves into: header line, a stat row and one
 * panel. Rendered by the route-level `loading.tsx` files, so navigation shows
 * the page's shape instead of a blank frame.
 */
export function PageSkeleton({
  stats = 4,
  label,
}: {
  /** Tiles in the stat row. 0 skips the row entirely. */
  stats?: number
  /** Announced while the real screen streams in. */
  label: string
}) {
  return (
    <div className="grid gap-6" role="status" aria-label={label}>
      <div className="grid gap-2">
        <div className="bg-surface-container h-8 w-48 animate-pulse rounded-lg" />
        <div className="bg-surface-container h-4 w-72 animate-pulse rounded-lg" />
      </div>

      {stats > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }, (_, index) => (
            <div
              key={index}
              className="border-border bg-card h-36 animate-pulse rounded-2xl border"
            />
          ))}
        </div>
      )}

      <div className="border-border bg-card h-80 animate-pulse rounded-xl border" />
    </div>
  )
}
