import { getMessages } from "@/lib/i18n/server"

/** Header, then the 2:1 bento — the form card and two contact cards. */
export default async function HelpLoading() {
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
      <div className="grid gap-4 sm:gap-6 md:grid-cols-12 md:items-start">
        <div className="border-border bg-card h-[32rem] animate-pulse rounded-xl border md:col-span-8" />
        <div className="grid gap-4 sm:gap-6 md:col-span-4">
          <div className="border-border bg-card h-40 animate-pulse rounded-2xl border" />
          <div className="border-border bg-card h-40 animate-pulse rounded-2xl border" />
        </div>
      </div>
    </div>
  )
}
