import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageLink } from "@/components/page-link"
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
  const hasNext = (count ?? 0) > to + 1
  const pageHref = (n: number) =>
    `/admin/customers?page=${n}${search ? `&q=${encodeURIComponent(search)}` : ""}`

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{cm.title}</h1>
      <form className="flex gap-2" action="/admin/customers">
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder={cm.search}
          className="border-input bg-background h-9 w-full max-w-sm rounded-md border px-3 text-sm"
        />
      </form>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{cm.name}</TableHead>
              <TableHead>{cm.phone}</TableHead>
              <TableHead>{cm.email}</TableHead>
              <TableHead>{cm.tier}</TableHead>
              <TableHead className="text-right">{cm.currentPoints}</TableHead>
              <TableHead className="text-right">{cm.lifetimePoints}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  {cm.empty}
                </TableCell>
              </TableRow>
            )}
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.full_name ?? "—"}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.membership_tiers?.name ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">
                  {c.current_points}
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {c.lifetime_points}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <PageLink href={pageHref(pageNum - 1)} disabled={pageNum <= 1}>
          {t.common.previous}
        </PageLink>
        <span className="text-muted-foreground text-sm">
          {t.common.page(pageNum)}
        </span>
        <PageLink href={pageHref(pageNum + 1)} disabled={!hasNext}>
          {t.common.next}
        </PageLink>
      </div>
    </div>
  )
}
