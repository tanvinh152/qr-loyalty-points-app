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
import { InitialsAvatar } from "@/components/initials-avatar"
import { Pagination } from "@/components/pagination"
import { PageHeader } from "@/components/page-header"
import { FieldLegend } from "@/components/field-legend"
import { SearchInput } from "@/components/search-input"
import { SectionCard } from "@/components/section-card"
import { StatusDot } from "@/components/status-dot"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import type { CustomerRow } from "@/lib/db-types"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.customers.metaTitle }
}

const PAGE_SIZE = 20

type CustomerWithTier = CustomerRow & {
  membership_tiers: { name: string } | null
}

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
    .select("*, membership_tiers(name)", { count: "exact" })
    .order("lifetime_points", { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`phone.ilike.%${search}%,full_name.ilike.%${search}%`)
  }

  const { data, count } = await query
  const customers = (data ?? []) as unknown as CustomerWithTier[]
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
          <EmptyState title={cm.empty} icon={Users} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{cm.name}</TableHead>
                <TableHead>{cm.phone}</TableHead>
                <TableHead>{cm.tier}</TableHead>
                <TableHead className="text-right">{cm.currentPoints}</TableHead>
                <TableHead className="text-right">
                  {cm.lifetimePoints}
                </TableHead>
                <TableHead>{cm.profileStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={c.full_name?.trim() || c.phone} />
                      <div>
                        <Link
                          href={`/admin/customers/${c.id}`}
                          className="text-body-sm leading-tight font-semibold hover:underline"
                        >
                          {c.full_name ?? c.phone}
                        </Link>
                        <p className="text-muted-foreground text-body-xs">
                          {c.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>
                    {c.membership_tiers ? (
                      <Badge variant="secondary">
                        {c.membership_tiers.name}
                      </Badge>
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
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
