import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Medal,
  MessageSquare,
  PawPrint,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getMessages } from "@/lib/i18n/server"
import {
  adjustMeta,
  getTiers,
  getTransactionTotals,
  getTransactions,
  tierProgress,
} from "@/lib/loyalty"
import type { CustomerRow, SupportRequestRow } from "@/lib/db-types"
import { AdjustForm } from "./adjust-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.customers.detail.metaTitle }
}

const PAGE_SIZE = 20
const SUPPORT_LIMIT = 5

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const t = await getMessages()
  const cm = t.admin.customers
  const d = cm.detail
  const { id } = await params
  const { page } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)

  const locale = await getLocale()
  const intlLocale = locale === "vi" ? "vi-VN" : "en-GB"
  const dateTime = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const dateOnly = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" })
  const monthYear = new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
  })

  const supabase = await createClient()
  const { data } = await supabase
    .from("customers")
    .select("*, membership_tiers(name)")
    .eq("id", id)
    .maybeSingle()

  // A bad id is a 404, not an empty page: the route is only ever reached from a
  // link, so a miss means the row is gone.
  if (!data) notFound()
  const customer = data as unknown as CustomerRow & {
    membership_tiers: { name: string } | null
  }

  const [tiers, totals, ledger, support] = await Promise.all([
    getTiers(),
    getTransactionTotals(customer.id),
    getTransactions(customer.id, { page: pageNum, pageSize: PAGE_SIZE }),
    supabase
      .from("support_requests")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(SUPPORT_LIMIT),
  ])

  const { current, next, floor, percent, toNext } = tierProgress(
    tiers,
    customer.lifetime_points,
  )
  const tickets = (support.data ?? []) as SupportRequestRow[]
  const hasNext = ledger.total > pageNum * PAGE_SIZE
  const name = customer.full_name?.trim() || customer.phone

  // Every profile value is optional — the screen is a progressive profile, so a
  // half-filled record is normal rather than an error.
  const value = (input: string | null) => input || "—"
  const asDate = (input: string | null) =>
    input ? dateOnly.format(new Date(input)) : "—"

  const ownerFields = [
    { label: d.email, value: value(customer.email) },
    { label: d.dob, value: asDate(customer.date_of_birth) },
  ]
  const petFields = [
    { label: d.petName, value: value(customer.pet_name) },
    {
      label: d.petType,
      value: customer.pet_type
        ? t.customer.profile.petTypes[customer.pet_type]
        : "—",
    },
    { label: d.petDob, value: asDate(customer.pet_dob) },
  ]

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/customers"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-fit",
        )}
      >
        <ArrowLeft aria-hidden />
        {d.backToList}
      </Link>

      <PageHeader
        title={name}
        description={customer.phone}
        eyebrow={
          <div className="flex items-center gap-3">
            <InitialsAvatar name={name} size="lg" />
            {customer.membership_tiers && (
              <Badge variant="secondary">
                {customer.membership_tiers.name}
              </Badge>
            )}
            <StatusDot
              label={
                customer.profile_completed_at
                  ? cm.profileComplete
                  : cm.profileIncomplete
              }
              tone={customer.profile_completed_at ? "success" : "neutral"}
            />
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.statAvailable}
          value={customer.current_points}
          icon={Wallet}
          highlight
        />
        <StatCard
          label={d.statLifetime}
          value={customer.lifetime_points}
          icon={TrendingUp}
          tone="secondary"
        />
        <StatCard
          label={d.statTransactions}
          value={totals.count}
          icon={Receipt}
          tone="neutral"
        />
        <StatCard
          label={d.statMemberSince}
          value={monthYear.format(new Date(customer.created_at))}
          icon={CalendarDays}
        />
      </div>

      <SectionCard title={d.adjust.title} icon={Wallet} bodyClassName="p-6">
        <AdjustForm customer={customer} tiers={tiers} />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={d.ownerTitle} icon={Medal} bodyClassName="p-6">
          <dl className="grid gap-3">
            {ownerFields.map((field) => (
              <div
                key={field.label}
                className="flex items-baseline justify-between gap-4"
              >
                <dt className="text-body-sm text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="text-body-sm text-right font-medium">
                  {field.value}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-body-sm text-muted-foreground">
                {d.profileCompletedAt}
              </dt>
              <dd className="text-body-sm text-right font-medium">
                {customer.profile_completed_at
                  ? dateOnly.format(new Date(customer.profile_completed_at))
                  : "—"}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title={d.petTitle} icon={PawPrint} bodyClassName="p-6">
          {customer.pet_name || customer.pet_type || customer.pet_dob ? (
            <dl className="grid gap-3">
              {petFields.map((field) => (
                <div
                  key={field.label}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="text-body-sm text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="text-body-sm text-right font-medium">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-body-sm text-muted-foreground">{d.noProfile}</p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={d.tierTitle}
        icon={Medal}
        bodyClassName="grid gap-3 p-6"
      >
        <div className="text-label-md flex items-center justify-between gap-2 uppercase">
          <span className="text-muted-foreground">
            {current ? current.name : d.noTier}
          </span>
          <span className="text-muted-foreground">
            {next ? next.name : d.topTier}
          </span>
        </div>
        <Progress value={percent / 100} label={d.tierTitle} />
        <div className="text-muted-foreground text-body-xs flex items-center justify-between tabular-nums">
          <span>{floor.toLocaleString()}</span>
          {next && <span>{next.threshold.toLocaleString()}</span>}
        </div>
        <p className="text-body-sm text-muted-foreground">
          {next ? d.toNext(toNext, next.name) : d.topTier}
          {current ? ` · ${d.multiplier(current.multiplier)}` : ""}
        </p>
      </SectionCard>

      <SectionCard
        title={d.historyTitle}
        icon={Receipt}
        footer={
          ledger.rows.length > 0 ? (
            <Pagination
              page={pageNum}
              shown={ledger.rows.length}
              total={ledger.total}
              hasNext={hasNext}
              hrefFor={(n) => `/admin/customers/${customer.id}?page=${n}`}
              labels={t.common}
              firstIndex={(pageNum - 1) * PAGE_SIZE + 1}
              pageSize={PAGE_SIZE}
            />
          ) : undefined
        }
      >
        {ledger.rows.length === 0 ? (
          <EmptyState icon={Receipt} title={d.historyEmpty} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.transactions.date}</TableHead>
                  <TableHead>{t.admin.transactions.type}</TableHead>
                  <TableHead>{t.admin.transactions.order}</TableHead>
                  <TableHead>{t.admin.transactions.source}</TableHead>
                  <TableHead className="text-right">
                    {t.admin.transactions.amount}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.rows.map((row) => {
                  const credit = row.amount >= 0
                  const Icon = credit ? ArrowUpRight : ArrowDownLeft
                  const adjust = adjustMeta(row)
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {dateTime.format(new Date(row.created_at))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "bg-surface-container grid size-8 shrink-0 place-items-center rounded-lg",
                              credit ? "text-secondary" : "text-destructive",
                            )}
                          >
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="text-body-sm font-semibold">
                            {/* A redemption names the reward it spent points
                                on; an earn has only the order code. */}
                            {row.reward?.name ??
                              t.admin.transactions.types[row.type]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-body-xs">
                        {adjust ? (
                          <div className="grid gap-0.5">
                            <span className="text-body-sm">
                              {adjust.reason}
                            </span>
                            <span className="text-muted-foreground">
                              {[
                                adjust.actor?.email &&
                                  t.admin.transactions.adjustBy(
                                    adjust.actor.email,
                                  ),
                                adjust.lifetime_delta !== 0 &&
                                  t.admin.transactions.adjustLifetime(
                                    adjust.lifetime_delta,
                                  ),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono">
                            {row.order_code ?? "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.admin.transactions.sources[row.source]}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-bold tabular-nums",
                          credit ? "text-secondary" : "text-destructive",
                        )}
                      >
                        {credit ? `+${row.amount}` : row.amount}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={d.supportTitle}
        icon={MessageSquare}
        actions={
          tickets.length > 0 ? (
            <Link
              href="/admin/support"
              className="text-primary text-label-md hover:underline"
            >
              {t.admin.support.title}
            </Link>
          ) : undefined
        }
      >
        {tickets.length === 0 ? (
          <EmptyState icon={MessageSquare} title={d.supportEmpty} />
        ) : (
          <ul className="divide-border divide-y">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="grid gap-1 px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {t.customer.help.topics[
                      ticket.topic as keyof typeof t.customer.help.topics
                    ] ?? ticket.topic}
                  </Badge>
                  <StatusDot
                    label={t.admin.support.statuses[ticket.status]}
                    tone={ticket.status === "open" ? "success" : "neutral"}
                  />
                  <span className="text-muted-foreground text-body-xs ml-auto">
                    {dateTime.format(new Date(ticket.created_at))}
                  </span>
                </div>
                <p className="text-body-sm text-muted-foreground line-clamp-2">
                  {ticket.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
