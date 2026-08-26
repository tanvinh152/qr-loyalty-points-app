import { getMessages } from "@/lib/i18n/server"

/**
 * The dashboard opens on a 12-column bento, not on the stat row the rest of the
 * account group shares — `PageSkeleton` would flash the wrong shape here, so
 * this route overrides it rather than reshaping the skeleton for six screens
 * that are still happy with it.
 *
 * Five blocks, matching the regions that are ALWAYS present: hero, the 4-slot,
 * the rewards list, the orders table and the blog row. The conditional tiles
 * (check-in, the wheel, the featured gift) cannot be known at skeleton time, so
 * guessing at them would flash a layout the page then contradicts.
 */
export default async function DashboardLoading() {
  const t = await getMessages()
  return (
    <div className="grid gap-4 sm:gap-6" role="status" aria-label={t.common.loading}>
      <div className="grid gap-2">
        <div className="bg-surface-container h-10 w-64 animate-pulse rounded-lg" />
        <div className="bg-surface-container h-4 w-48 animate-pulse rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* The hero is a filled gradient, so its placeholder carries no border —
            a hairline here would flash a card edge the real tile never has. */}
        <div className="bg-surface-container h-72 animate-pulse rounded-4xl lg:col-span-8" />
        <div className="border-border bg-card h-72 animate-pulse rounded-3xl border lg:col-span-4" />
        <div className="border-border bg-card h-64 animate-pulse rounded-3xl border lg:col-span-6" />
        <div className="border-border bg-card h-64 animate-pulse rounded-3xl border lg:col-span-6" />
        {/* The blog strip is three bare tiles under a bare heading, not one
            full-width panel. */}
        <div className="col-span-full grid gap-4 sm:gap-6">
          <div className="bg-surface-container h-7 w-40 animate-pulse rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            <div className="border-border bg-card h-64 animate-pulse rounded-3xl border" />
            <div className="border-border bg-card h-64 animate-pulse rounded-3xl border" />
            <div className="border-border bg-card h-64 animate-pulse rounded-3xl border" />
          </div>
        </div>
      </div>
    </div>
  )
}
