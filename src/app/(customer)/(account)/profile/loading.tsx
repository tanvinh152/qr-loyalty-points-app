import { getMessages } from "@/lib/i18n/server"

/** One card split photo | form — the page is a single region. */
export default async function ProfileLoading() {
  const t = await getMessages()
  return (
    <div
      className="border-border bg-card grid overflow-hidden rounded-3xl border lg:grid-cols-2"
      role="status"
      aria-label={t.common.loading}
    >
      <div className="bg-surface-container min-h-64 animate-pulse" />
      <div className="grid gap-6 p-4 sm:gap-8 sm:p-6 md:p-12">
        <div className="bg-surface-container h-8 w-48 animate-pulse rounded-lg" />
        <div className="grid gap-4">
          <div className="bg-surface-container h-12 animate-pulse rounded-full" />
          <div className="bg-surface-container h-12 animate-pulse rounded-full" />
        </div>
        <div className="grid gap-4">
          <div className="bg-surface-container h-12 animate-pulse rounded-full" />
          <div className="bg-surface-container h-24 animate-pulse rounded-2xl" />
          <div className="bg-surface-container h-12 animate-pulse rounded-full" />
        </div>
        <div className="bg-surface-container h-14 animate-pulse rounded-md" />
      </div>
    </div>
  )
}
