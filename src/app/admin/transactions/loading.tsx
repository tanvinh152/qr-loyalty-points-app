import { PageSkeleton } from "@/components/page-skeleton"
import { getMessages } from "@/lib/i18n/server"

export default async function TransactionsLoading() {
  const t = await getMessages()
  // Three stats, the six-control filter bar, then the ledger.
  return <PageSkeleton stats={3} filter label={t.common.loading} />
}
