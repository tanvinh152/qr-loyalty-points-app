import { getMessages } from "@/lib/i18n/server"

/** Header, the 5/7 identity + progress split, then the ladder table. */
export default async function TiersLoading() {
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
      <div className="grid gap-4 sm:gap-6 md:grid-cols-12">
        <div className="border-border bg-card h-96 animate-pulse rounded-3xl border md:col-span-5" />
        <div className="border-border bg-card h-96 animate-pulse rounded-3xl border md:col-span-7" />
      </div>
      <div className="border-border bg-card h-80 animate-pulse rounded-3xl border" />
    </div>
  )
}
