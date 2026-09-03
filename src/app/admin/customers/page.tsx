import Link from "next/link"
import { Users } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { InitialsAvatar } from "@/components/initials-avatar"
import { Pagination } from "@/components/pagination"
import { PageHeader } from "@/components/page-header"
import { FieldLegend } from "@/components/field-legend"
import { SearchInput } from "@/components/search-input"
import { SectionCard } from "@/components/section-card"
import { StatusDot } from "@/components/status-dot"
import { TruncatedText } from "@/components/truncated-text"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { formatVnd } from "@/lib/utils"
import { getTiers, resolveDisplayTier } from "@/lib/loyalty"
import type { CustomerRow } from "@/lib/db-types"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.customers.metaTitle }
}

const PAGE_SIZE = 20

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const t = await getMessages()
  const cm = t.admin.customers
  const { page, q } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const search = q?.trim()

  const supabase = await createClient()
  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    // Spend, not points: the list is ordered by what now decides the tier.
    .order("lifetime_spend", { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`phone.ilike.%${search}%,full_name.ilike.%${search}%`)
  }

  const [{ data, count }, tiers] = await Promise.all([query, getTiers()])
  const customers = (data ?? []) as unknown as CustomerRow[]
  const total = count ?? 0
  const hasNext = total > to + 1
  const pageHref = (n: number) =>
    `/admin/customers?page=${n}${search ? `&q=${encodeURIComponent(search)}` : ""}`

  return (
    <div className="grid gap-6">
      <PageHeader title={cm.title} description={cm.subtitle}>
        <div className="border-border bg-card flex items-center gap-6 rounded-lg border px-6 py-2">
          <div>
            <p className="text-label-md text-muted-foreground tracking-wider uppercase">
              {cm.totalMembers}
            </p>
            <p className="text-primary text-xl font-bold tabular-nums">
              {total.toLocaleString()}
            </p>
          </div>
        </div>
      </PageHeader>

      <SearchInput
        action="/admin/customers"
        defaultValue={search}
        label={cm.search}
        placeholder={cm.search}
        className="sm:w-96"
      />

      <FieldLegend
        items={[
          { term: cm.currentPoints, hint: cm.currentPointsHint },
          { term: cm.lifetimePoints, hint: cm.lifetimePointsHint },
          { term: cm.lifetimeSpend, hint: cm.lifetimeSpendHint },
        ]}
      />

      <SectionCard
        footer={
          <Pagination
            page={pageNum}
            shown={customers.length}
            total={total}
            hasNext={hasNext}
            hrefFor={pageHref}
            labels={t.common}
          />
        }
      >
        {customers.length === 0 ? (
          <EmptyState
            title={search ? cm.noMatch : cm.empty}
            icon={Users}
            action={
              search ? (
                <Link
                  href="/admin/customers"
                  className={buttonVariants({ variant: "secondary" })}
                >
                  {t.common.clearFilters}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{cm.name}</TableHead>
                  <TableHead>{cm.phone}</TableHead>
                  <TableHead>{cm.tier}</TableHead>
                  <TableHead className="text-right">
                    {cm.currentPoints}
                  </TableHead>
                  <TableHead className="text-right">
                    {cm.lifetimePoints}
                  </TableHead>
                  <TableHead className="text-right">
                    {cm.lifetimeSpend}
                  </TableHead>
                  <TableHead>{cm.profileStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => {
                  const displayTier = resolveDisplayTier(tiers, c)
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-[280px]">
                        <div className="flex items-center gap-3">
                          <InitialsAvatar
                            name={c.full_name?.trim() || c.phone}
                          />
                          <div className="min-w-0">
                            {/* Both lines are free text the member typed, and
                              the synthetic auth email is long by construction. */}
                            <TruncatedText
                              lines={1}
                              focusable={false}
                              tooltip={c.full_name ?? c.phone}
                            >
                              <Link
                                href={`/admin/customers/${c.id}`}
                                className="text-body-sm leading-tight font-semibold hover:underline"
                              >
                                {c.full_name ?? c.phone}
                              </Link>
                            </TruncatedText>
                            <TruncatedText
                              lines={1}
                              className="text-muted-foreground text-body-xs"
                            >
                              {c.email ?? "—"}
                            </TruncatedText>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell>
                        {displayTier ? (
                          <Badge variant="secondary">{displayTier.name}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-primary text-right font-bold tabular-nums">
                        {c.current_points.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {c.lifetime_points.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatVnd(c.lifetime_spend)}
                      </TableCell>
                      <TableCell>
                        <StatusDot
                          label={
                            c.profile_completed_at
                              ? cm.profileComplete
                              : cm.profileIncomplete
                          }
                          tone={c.profile_completed_at ? "success" : "neutral"}
                        />
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
