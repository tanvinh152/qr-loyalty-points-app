import Link from "next/link"
import { CheckCheck, Inbox, MessageSquare, Timer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"
import { InitialsAvatar } from "@/components/initials-avatar"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { SectionCard } from "@/components/section-card"
import { StatCard } from "@/components/stat-card"
import { StatusDot } from "@/components/status-dot"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getSupportCounts } from "@/lib/support"
import type { SupportRequestRow, SupportRequestStatus } from "@/lib/db-types"
import { SupportDialog } from "./support-dialog"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.support.metaTitle }
}

const PAGE_SIZE = 20

type SupportRow = SupportRequestRow & {
  customers: { full_name: string | null; phone: string } | null
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const t = await getMessages()
  const s = t.admin.support
  const locale = await getLocale()
  const dateFormat = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    { dateStyle: "short", timeStyle: "short" },
  )

  const { page, status } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  // Anything but the two known values means "no filter", so a hand-typed query
  // string cannot produce an empty page.
  const filter: SupportRequestStatus | null =
    status === "open" || status === "closed" ? status : null

  const supabase = await createClient()
  let query = supabase
    .from("support_requests")
    .select("*, customers(full_name, phone)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)
  if (filter) query = query.eq("status", filter)

  const [list, counts] = await Promise.all([query, getSupportCounts()])

  const rows = (list.data ?? []) as unknown as SupportRow[]
  const total = list.count ?? 0
  const hasNext = total > to + 1

  const hrefFor = (n: number) => {
    const params = new URLSearchParams({ page: String(n) })
    if (filter) params.set("status", filter)
    return `/admin/support?${params}`
  }

  const tabs: { key: SupportRequestStatus | null; label: string }[] = [
    { key: null, label: s.filterAll },
    { key: "open", label: s.statuses.open },
    { key: "closed", label: s.statuses.closed },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader title={s.title} description={s.subtitle} />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={s.statOpen}
          value={counts.open}
          hint={s.statOpenHint}
          icon={Inbox}
          highlight={counts.open > 0}
        />
        <StatCard
          label={s.statClosed}
          value={counts.closed}
          icon={CheckCheck}
          tone="secondary"
        />
        <StatCard
          label={s.statTotal}
          value={counts.open + counts.closed}
          icon={MessageSquare}
          tone="neutral"
        />
        <StatCard label={s.statWeek} value={counts.week} icon={Timer} />
      </div>

      {/* Filter is three links, not a form: the page is a server component and
          the state already lives in the URL. */}
      <nav aria-label={s.filterLabel} className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = filter === tab.key
          return (
            <Link
              key={tab.label}
              href={
                tab.key ? `/admin/support?status=${tab.key}` : "/admin/support"
              }
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-label-md rounded-lg border px-4 py-2 transition-colors",
                active
                  ? "border-primary/15 bg-accent text-accent-foreground font-semibold"
                  : "border-border text-muted-foreground hover:bg-surface-container hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <SectionCard
        footer={
          rows.length > 0 ? (
            <Pagination
              page={pageNum}
              shown={rows.length}
              total={total}
              hasNext={hasNext}
              hrefFor={hrefFor}
              labels={t.common}
              firstIndex={from + 1}
              pageSize={PAGE_SIZE}
            />
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={filter === "open" ? s.emptyOpen : s.empty}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{s.date}</TableHead>
                  <TableHead>{s.customer}</TableHead>
                  <TableHead>{s.topic}</TableHead>
                  <TableHead>{s.message}</TableHead>
                  <TableHead>{s.status}</TableHead>
                  <TableHead className="text-right">
                    {t.common.actions}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const name = row.customers?.full_name || row.name
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {dateFormat.format(new Date(row.created_at))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={name} />
                          <div className="min-w-0">
                            {/* Only a linked ticket can drill through — the form
                                accepts a name and email of the customer's
                                choosing, so the account is the only sure link. */}
                            {row.customer_id ? (
                              <Link
                                href={`/admin/customers/${row.customer_id}`}
                                className="text-body-sm font-semibold hover:underline"
                              >
                                {name}
                              </Link>
                            ) : (
                              <p className="text-body-sm font-semibold">
                                {name}
                              </p>
                            )}
                            <p className="text-muted-foreground text-body-xs">
                              {row.customer_id ? row.email : s.guest}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {t.customer.help.topics[
                            row.topic as keyof typeof t.customer.help.topics
                          ] ?? row.topic}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs">
                        <span className="line-clamp-2">{row.message}</span>
                      </TableCell>
                      <TableCell>
                        <StatusDot
                          label={s.statuses[row.status]}
                          tone={row.status === "open" ? "success" : "neutral"}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <SupportDialog
                            row={row}
                            receivedAt={dateFormat.format(
                              new Date(row.created_at),
                            )}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
