import { PageSkeleton } from "@/components/page-skeleton"
import { getMessages } from "@/lib/i18n/server"

export default async function HistoryLoading() {
  const t = await getMessages()
  // Header, three stats, the filter bar, then the ledger — the page's shape.
  return <PageSkeleton stats={3} filter label={t.common.loading} />
}
