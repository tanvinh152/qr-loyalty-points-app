import Form from "next/form"
import Link from "next/link"
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleCheck,
  Receipt,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { SectionCard } from "@/components/section-card"
import { StatCard } from "@/components/stat-card"
import { SubmitButton } from "@/components/submit-button"
import { ENTER } from "@/lib/motion/tokens"
import { TruncatedText } from "@/components/truncated-text"
import { cn } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getTransactionTotals, getTransactions } from "@/lib/loyalty"
import { getAccount } from "../account"
import { transactionCode, transactionTitle } from "../transactions"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.history.metaTitle }
}

const PAGE_SIZE = 20

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    from?: string
    to?: string
  }>
}) {
  const t = await getMessages()
  const h = t.customer.history
  const { customer } = await getAccount()
  if (!customer) return null

  const locale = await getLocale()
  const dateFormat = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  )

  const { page, q, from, to } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  // ISO dates compare as strings. A backwards range used to run the query and
  // come back empty, indistinguishable from a ledger with nothing in it.
  const rangeInvalid = Boolean(from && to && from > to)
  const [{ rows, total }, totals] = await Promise.all([
    rangeInvalid
      ? { rows: [], total: 0 }
      : getTransactions(customer.id, {
          page: pageNum,
          pageSize: PAGE_SIZE,
          search: q,
          from,
          to,
        }),
    getTransactionTotals(customer.id),
  ])
  const hasNext = total > pageNum * PAGE_SIZE
  const filtered = Boolean(q || from || to)

  // Filters have to survive paging, so every page link carries them along.
  const hrefFor = (n: number) => {
    const params = new URLSearchParams({ page: String(n) })
    if (q) params.set("q", q)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    return `/history?${params}`
  }

  // Derived once so the phone list and the desktop table cannot drift. The code
  // and the label come from `../transactions`, which the dashboard's activity
  // table reads too — the two screens show the same rows and must name them the
  // same way.
  const entries = rows.map((row) => ({
    row,
    credit: row.amount >= 0,
    code: transactionCode(row),
    title: transactionTitle(row, h),
  }))

  return (
    <div className="grid gap-4 sm:gap-6">
      <PageHeader title={h.title} description={h.subtitle} size="display" />

      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        <StatCard label={h.statCount} value={totals.count} icon={Receipt} />
        <StatCard
          label={h.statEarned}
          value={totals.earned}
          icon={TrendingUp}
          tone="secondary"
        />
        <StatCard
          label={h.statSpent}
          value={totals.spent}
          icon={TrendingDown}
          highlight
        />
      </div>

      {/* One GET form for all three filters. `next/form` makes the submit a
          client-side navigation, which is what lets the button pend through
          useFormStatus; without JS it is still a plain GET. Paging resets by
          omitting `page`. */}
      <Form
        action="/history"
        className="border-border bg-card grid gap-4 rounded-2xl border p-4 sm:gap-5 sm:p-5 md:grid-cols-[1fr_auto_auto_auto] md:items-end"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="history-q">{h.searchLabel}</Label>
          <Input
            id="history-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder={h.searchPlaceholder}
            icon={Search}
            className="text-body-sm h-12"
            aria-describedby="history-q-hint"
          />
          {/* The search runs on `order_code`, but the list shows a TXN- code
              derived from the row id — say so, or the visible code gets typed
              in and returns nothing. */}
          <p id="history-q-hint" className="text-body-xs text-muted-foreground">
            {h.searchHint}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="history-from">{h.fromLabel}</Label>
          <Input
            id="history-from"
            type="date"
            name="from"
            defaultValue={from}
            max={to || undefined}
            className="text-body-sm h-12"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="history-to">{h.toLabel}</Label>
          <Input
            id="history-to"
            type="date"
            name="to"
            defaultValue={to}
            min={from || undefined}
            className="text-body-sm h-12"
          />
        </div>
        <div className="flex gap-2">
          <SubmitButton
            icon={<SlidersHorizontal className="size-4" aria-hidden />}
            className="h-12 grow px-8 md:grow-0"
          >
            {h.filterCta}
          </SubmitButton>
          {filtered && (
            <Link
              href="/history"
              className={cn(buttonVariants({ variant: "ghost" }), "h-12")}
            >
              {h.resetCta}
            </Link>
          )}
        </div>
      </Form>

      {/* The entrance is on the ledger ALONE: this page remounts on every
          filter or page change (the segment key carries the search params), so
          the header and the filter bar must not wear it or they would replay
          on each click. The ledger replaying reads as the new rows arriving. */}
      <SectionCard
        className={ENTER}
        footer={
          rows.length > 0 ? (
            <Pagination
              page={pageNum}
              shown={rows.length}
              total={total}
              hasNext={hasNext}
              hrefFor={hrefFor}
              labels={t.common}
              firstIndex={(pageNum - 1) * PAGE_SIZE + 1}
              pageSize={PAGE_SIZE}
            />
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          // Three different nothings: a backwards range, a filter that matched
          // no rows, and a ledger that is genuinely empty. Only the last one
          // has no way out.
          <EmptyState
            icon={Receipt}
            title={rangeInvalid || filtered ? h.noMatchTitle : h.emptyTitle}
            description={
              rangeInvalid
                ? h.rangeInvalid
                : filtered
                  ? h.noMatchBody
                  : h.emptyBody
            }
            action={
              rangeInvalid || filtered ? (
                <Link
                  href="/history"
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "mt-2",
                  )}
                >
                  {h.resetCta}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* A phone cannot show a five-column ledger without side-scrolling
                it, so it gets the same rows as a list instead. Kind and status
                are dropped there: the arrow and the sign already carry the
                kind, and every committed row has the same status. */}
            <ul className="divide-border divide-y sm:hidden">
              {entries.map(({ row, credit, code, title }) => {
                const Icon = credit ? ArrowUpRight : ArrowDownLeft
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "bg-surface-container grid size-10 shrink-0 place-items-center rounded-xl",
                          credit ? "text-secondary" : "text-destructive",
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{title}</p>
                        <p className="text-label-sm text-muted-foreground truncate font-mono">
                          {code}
                        </p>
                        <p className="text-body-xs text-muted-foreground">
                          {dateFormat.format(new Date(row.created_at))}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-bold tabular-nums",
                        credit ? "text-secondary" : "text-destructive",
                      )}
                    >
                      {credit ? `+${row.amount}` : row.amount}
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{h.transaction}</TableHead>
                    <TableHead>{h.kind}</TableHead>
                    <TableHead>{h.amount}</TableHead>
                    <TableHead>{h.time}</TableHead>
                    <TableHead>{h.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(({ row, credit, code, title }) => {
                    const Icon = credit ? ArrowUpRight : ArrowDownLeft
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[280px]">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "bg-surface-container grid size-12 shrink-0 place-items-center rounded-xl",
                                credit ? "text-secondary" : "text-destructive",
                              )}
                            >
                              <Icon className="size-5" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              {/* A reward name is admin free text and the order
                                  label carries a POS code — both outrun the
                                  column on a narrow window. */}
                              <TruncatedText className="font-semibold">
                                {title}
                              </TruncatedText>
                              <p className="text-label-sm text-muted-foreground font-mono">
                                {code}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {h.types[row.type]}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "font-bold tabular-nums",
                            credit ? "text-secondary" : "text-destructive",
                          )}
                        >
                          {credit ? `+${row.amount}` : row.amount}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {dateFormat.format(new Date(row.created_at))}
                        </TableCell>
                        <TableCell>
                          {/* The ledger is append-only and every row is already
                              committed, so there is only one possible state. */}
                          <Badge variant="success" className="gap-1.5">
                            <CircleCheck className="size-4" aria-hidden />
                            {h.statusDone}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}
