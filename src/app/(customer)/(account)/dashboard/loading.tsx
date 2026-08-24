import { getMessages } from "@/lib/i18n/server"

/**
 * The dashboard opens on one wide hero, not on the stat row the rest of the
 * account group shares — `PageSkeleton` would flash the wrong shape here, so
 * this route overrides it rather than reshaping the skeleton for six screens
 * that are still happy with it.
 */
export default async function DashboardLoading() {
  const t = await getMessages()
  return (
    <div className="grid gap-4 sm:gap-6" role="status" aria-label={t.common.loading}>
      <div className="grid gap-2">
        <div className="bg-surface-container h-10 w-64 animate-pulse rounded-lg" />
        <div className="bg-surface-container h-4 w-48 animate-pulse rounded-lg" />
      </div>
      <div className="border-border bg-card h-64 animate-pulse rounded-4xl border" />
      <div className="border-border bg-card h-64 animate-pulse rounded-3xl border" />
      <div className="border-border bg-card h-80 animate-pulse rounded-3xl border" />
    </div>
  )
}
