import Link from "next/link"
import {
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
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { SectionCard } from "@/components/section-card"
import { StatCard } from "@/components/stat-card"
import { cn } from "@/lib/utils"
import { adjustMeta, getAdminTransactions } from "@/lib/loyalty"
import { getLocale, getMessages } from "@/lib/i18n/server"
import type { TransactionSource, TransactionType } from "@/lib/db-types"

// Raw DB enums mean nothing to a shop owner — each one gets a label and a hue.
const TYPE_VARIANT: Record<TransactionType, "success" | "warning" | "muted"> = {
  EARN: "success",
  REDEEM: "warning",
  ADJUST: "muted",
}

const TYPES: TransactionType[] = ["EARN", "REDEEM", "ADJUST"]
const SOURCES: TransactionSource[] = ["claim", "webhook", "admin", "redeem"]

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.transactions.metaTitle }
}

const PAGE_SIZE = 20

/** Shared field chrome for the two native selects in the filter bar. */
const SELECT_CLASS =
  "border-input bg-card text-body-sm h-12 rounded-lg border px-3 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    from?: string
    to?: string
    type?: string
    source?: string
  }>
}) {
  const t = await getMessages()
  const tx = t.admin.transactions
  // Server-rendered, so format explicitly against the active locale instead of
  // letting toLocaleString() pick up the server's default.
  const locale = await getLocale()
  const dateFormat = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  )
  const params = await searchParams
  const pageNum = Math.max(1, Number(params.page) || 1)
  // A hand-typed enum outside the union would silently match nothing, so
  // anything unknown is treated as "no filter".
  const type = TYPES.includes(params.type as TransactionType)
    ? (params.type as TransactionType)
    : undefined
  const source = SOURCES.includes(params.source as TransactionSource)
    ? (params.source as TransactionSource)
    : undefined
  const search = params.q?.trim() || undefined

  const { rows, total, issued, redeemed } = await getAdminTransactions({
    page: pageNum,
    pageSize: PAGE_SIZE,
    search,
    from: params.from,
    to: params.to,
    type,
    source,
  })

  const hasNext = total > pageNum * PAGE_SIZE
  const filtered = Boolean(search || params.from || params.to || type || source)

  // Filters have to survive paging, so every page link carries them along.
  const hrefFor = (n: number) => {
    const next = new URLSearchParams({ page: String(n) })
    if (search) next.set("q", search)
    if (params.from) next.set("from", params.from)
    if (params.to) next.set("to", params.to)
    if (type) next.set("type", type)
    if (source) next.set("source", source)
    return `/admin/transactions?${next}`
  }

  return (
    <div className="grid gap-6">
      <PageHeader title={tx.title} description={tx.subtitle} />

      <div className="grid gap-6 sm:grid-cols-3">
        <StatCard
          label={tx.statCount}
          value={total}
          hint={tx.statCountHint}
          icon={Receipt}
        />
        <StatCard
          label={tx.statIssued}
          value={issued}
          icon={TrendingUp}
          tone="secondary"
        />
        <StatCard
          label={tx.statRedeemed}
          value={redeemed}
          icon={TrendingDown}
          highlight
        />
      </div>

      {/* One GET form for every filter: submitting navigates, so no client
          component is involved. Paging resets by omitting `page`. */}
      <form
        action="/admin/transactions"
        className="border-border bg-card grid gap-5 rounded-2xl border p-5 md:grid-cols-2 md:items-end xl:grid-cols-[1fr_auto_auto_auto_auto_auto]"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="tx-q">{tx.searchLabel}</Label>
          <Input
            id="tx-q"
            type="search"
            name="q"
            defaultValue={search}
            placeholder={tx.searchPlaceholder}
            icon={Search}
            className="text-body-sm h-12"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tx-from">{tx.fromLabel}</Label>
          <Input
            id="tx-from"
            type="date"
            name="from"
            defaultValue={params.from}
            className="text-body-sm h-12"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tx-to">{tx.toLabel}</Label>
          <Input
            id="tx-to"
            type="date"
            name="to"
            defaultValue={params.to}
            className="text-body-sm h-12"
          />
        </div>
        {/* Native selects rather than the Base UI one: the browser submits this
            form, and a headless select would need a client component just to
            mirror its value into a hidden input. */}
        <div className="grid gap-1.5">
          <Label htmlFor="tx-type">{tx.type}</Label>
          <select
            id="tx-type"
            name="type"
            defaultValue={type ?? ""}
            className={SELECT_CLASS}
          >
            <option value="">{tx.typeAll}</option>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {tx.types[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tx-source">{tx.source}</Label>
          <select
            id="tx-source"
            name="source"
            defaultValue={source ?? ""}
            className={SELECT_CLASS}
          >
            <option value="">{tx.sourceAll}</option>
            {SOURCES.map((value) => (
              <option key={value} value={value}>
                {tx.sources[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="h-12 rounded-xl px-6">
            <SlidersHorizontal className="size-4" aria-hidden />
            {tx.filterCta}
          </Button>
          {filtered && (
            <Link
              href="/admin/transactions"
              className={cn(buttonVariants({ variant: "ghost" }), "h-12")}
            >
              {tx.resetCta}
            </Link>
          )}
        </div>
      </form>

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
              firstIndex={(pageNum - 1) * PAGE_SIZE + 1}
              pageSize={PAGE_SIZE}
            />
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <EmptyState icon={Receipt} title={filtered ? tx.noMatch : tx.empty} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{tx.date}</TableHead>
                  <TableHead>{tx.customer}</TableHead>
                  <TableHead>{tx.order}</TableHead>
                  <TableHead>{tx.type}</TableHead>
                  <TableHead>{tx.source}</TableHead>
                  <TableHead className="text-right">{tx.amount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  // An ADJUST row has no order code and no reward — the staff
                  // note is the only thing that explains why it exists.
                  const adjust = adjustMeta(row)
                  return (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {dateFormat.format(new Date(row.created_at))}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {/* The ledger keeps its own copy of the phone, so a row
                          whose customer row is gone still names someone. */}
                      <Link
                        href={`/admin/customers/${row.customer_id}`}
                        className="hover:underline"
                      >
                        {row.customers?.full_name ??
                          row.customers?.phone ??
                          row.phone}
                      </Link>
                    </TableCell>
                    <TableCell className="text-body-xs">
                      {adjust ? (
                        <div className="grid gap-0.5">
                          <span className="text-body-sm">{adjust.reason}</span>
                          <span className="text-muted-foreground">
                            {[
                              adjust.actor?.email &&
                                tx.adjustBy(adjust.actor.email),
                              adjust.lifetime_delta !== 0 &&
                                tx.adjustLifetime(adjust.lifetime_delta),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono">
                          {row.order_code ?? row.reward?.name ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANT[row.type]}>
                        {tx.types[row.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tx.sources[row.source]}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-bold tabular-nums",
                        row.amount > 0
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {row.amount > 0 ? `+${row.amount}` : row.amount}
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
