import { PageSkeleton } from "@/components/page-skeleton"
import { getMessages } from "@/lib/i18n/server"

export default async function AccountLoading() {
  const t = await getMessages()
  // The customer screens open on two or three tiles, not four.
  return <PageSkeleton stats={3} label={t.common.loading} />
}
