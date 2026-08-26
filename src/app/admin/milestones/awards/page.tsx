import Link from "next/link"
import { ArrowLeft, Gift } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
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
import { TruncatedText } from "@/components/truncated-text"
import { cn, formatVnd } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getMessages } from "@/lib/i18n/server"
import type { MilestoneAwardRow } from "@/lib/db-types"
import { FulfillButton } from "./fulfill-button"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.milestones.awards.metaTitle }
}

const PAGE_SIZE = 20

// Every milestone prize is handed over by hand — the ladder credits no points
// and writes no transaction (0024) — so unlike the wheel's queue there is no
// prize_type to filter on here.
type AwardRow = MilestoneAwardRow & {
  customers: { full_name: string | null; phone: string } | null
}

export default async function MilestoneAwardsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>
}) {
  const t = await getMessages()
  const m = t.admin.milestones.awards
  const mm = t.admin.rewards.milestone
  const locale = await getLocale()
  const dateFormat = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    { dateStyle: "short", timeStyle: "short" },
  )

  const { page, filter } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  // Anything but the one known value means "no filter", so a hand-typed query
  // string cannot produce an empty page.
  const pendingOnly = filter === "pending"

  // The RLS-scoped cookie client, not the service role: "read own milestone
  // awards" (0024) already lets an admin see every row, and "admin update
  // milestone awards" is what the button below writes through.
  const supabase = await createClient()
  let query = supabase
    .from("milestone_awards")
    .select("*, customers(full_name, phone)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)
  if (pendingOnly) query = query.is("fulfilled_at", null)

  const [list, pending] = await Promise.all([
    query,
    supabase
      .from("milestone_awards")
      .select("*", { count: "exact", head: true })
      .is("fulfilled_at", null),
  ])

  const rows = (list.data ?? []) as unknown as AwardRow[]
  const total = list.count ?? 0
  const hasNext = total > to + 1
  const pendingCount = pending.count ?? 0

  const hrefFor = (n: number) => {
    const params = new URLSearchParams({ page: String(n) })
    if (pendingOnly) params.set("filter", "pending")
    return `/admin/milestones/awards?${params}`
  }

  const tabs = [
    { key: "pending", label: m.filterPending, active: pendingOnly },
    { key: null, label: m.filterAll, active: !pendingOnly },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader title={m.title} description={m.subtitle}>
        <Link
          href="/admin/rewards?kind=milestone"
          className={buttonVariants({ variant: "secondary" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {m.backToMilestones}
        </Link>
      </PageHeader>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={mm.statPending}
          value={pendingCount}
          hint={mm.statPendingHint}
          icon={Gift}
          highlight={pendingCount > 0}
        />
      </div>

      {/* Filter is two links, not a form: the page is a server component and
          the state already lives in the URL. */}
      <nav aria-label={m.filterLabel} className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={
              tab.key
                ? `/admin/milestones/awards?filter=${tab.key}`
                : "/admin/milestones/awards"
            }
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "text-label-md rounded-lg border px-4 py-2 transition-colors",
              tab.active
                ? "border-primary/15 bg-accent text-accent-foreground font-semibold"
                : "border-border text-muted-foreground hover:bg-surface-container hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
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
            icon={Gift}
            title={pendingOnly ? m.emptyPending : m.empty}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{m.claimedAt}</TableHead>
                  <TableHead>{m.customer}</TableHead>
                  <TableHead>{m.milestone}</TableHead>
                  <TableHead className="text-right">{m.threshold}</TableHead>
                  <TableHead>{m.status}</TableHead>
                  <TableHead className="text-right">
                    {t.common.actions}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const name =
                    row.customers?.full_name || row.customers?.phone || "—"
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {dateFormat.format(new Date(row.created_at))}
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={name} />
                          <div className="min-w-0">
                            <TruncatedText
                              lines={1}
                              focusable={false}
                              tooltip={name}
                            >
                              <Link
                                href={`/admin/customers/${row.customer_id}`}
                                className="text-body-sm font-semibold hover:underline"
                              >
                                {name}
                              </Link>
                            </TruncatedText>
                            <TruncatedText
                              lines={1}
                              className="text-muted-foreground text-body-xs"
                            >
                              {row.customers?.phone ?? ""}
                            </TruncatedText>
                          </div>
                        </div>
                      </TableCell>
                      {/* The frozen name and threshold off the claim, not a
                          join: the rung may have been renamed, re-priced or
                          deleted since. */}
                      <TableCell className="max-w-xs">
                        <TruncatedText lines={1}>
                          {row.milestone_name}
                        </TruncatedText>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {formatVnd(row.threshold_amount)}
                      </TableCell>
                      <TableCell>
                        <StatusDot
                          label={
                            row.fulfilled_at
                              ? m.statusFulfilled
                              : m.statusPending
                          }
                          tone={row.fulfilled_at ? "success" : "neutral"}
                        />
                        {/* When it was settled, and by implication that the
                            row needs nothing further. */}
                        {row.fulfilled_at && (
                          <p className="text-muted-foreground text-body-xs mt-0.5 whitespace-nowrap">
                            {m.fulfilledOn(
                              dateFormat.format(new Date(row.fulfilled_at)),
                            )}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <FulfillButton
                            id={row.id}
                            fulfilled={row.fulfilled_at !== null}
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
