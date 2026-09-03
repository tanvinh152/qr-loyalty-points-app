import { getMessages } from "@/lib/i18n/server"

/** A header and three rungs on a rail — the ladder's shape, not a stat row. */
export default async function RoadmapLoading() {
  const t = await getMessages()
  return (
    <div
      className="grid gap-4 sm:gap-6"
      role="status"
      aria-label={t.common.loading}
    >
      <div className="grid gap-2">
        <div className="bg-surface-container h-10 w-64 animate-pulse rounded-lg" />
        <div className="bg-surface-container h-4 w-80 max-w-full animate-pulse rounded-lg" />
      </div>
      <div className="grid gap-8 md:gap-10">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 md:gap-6">
            <div className="bg-surface-container size-16 shrink-0 animate-pulse rounded-full" />
            <div className="border-border bg-card h-28 grow animate-pulse rounded-3xl border" />
          </div>
        ))}
      </div>
    </div>
  )
}
