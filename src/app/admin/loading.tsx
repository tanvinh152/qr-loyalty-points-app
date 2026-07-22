import { PageSkeleton } from "@/components/page-skeleton"
import { getMessages } from "@/lib/i18n/server"

export default async function AdminLoading() {
  const t = await getMessages()
  return <PageSkeleton label={t.common.loading} />
}
