import { getMessages } from "@/lib/i18n/server"

/**
 * The shop opens on a balance, a chip strip and a card grid — none of which
 * the shared stat-row skeleton has. Skeletons wear no entrance: they are what
 * the entrance plays over.
 */
export default async function RewardsLoading() {
  const t = await getMessages()
  return (
    <div
      className="grid gap-4 sm:gap-6"
      role="status"
      aria-label={t.common.loading}
    >
      <div className="grid gap-2">
        <div className="bg-surface-container h-4 w-24 animate-pulse rounded-lg" />
        <div className="bg-surface-container h-12 w-48 animate-pulse rounded-lg" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="bg-surface-container h-9 w-24 animate-pulse rounded-full"
          />
        ))}
      </div>
      <div className="grid gap-4 sm:gap-6 md:grid-cols-12">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="border-border bg-card h-72 animate-pulse rounded-3xl border md:col-span-4"
          />
        ))}
      </div>
    </div>
  )
}
