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
import type { CustomerRow } from "@/lib/db-types"

export const metadata = { title: "Customers" }

const PAGE_SIZE = 20

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data, count } = await supabase
    .from("customers")
    .select("*", { count: "exact" })
    .order("total_points", { ascending: false })
    .range(from, to)

  const customers = (data ?? []) as CustomerRow[]
  const hasNext = (count ?? 0) > to + 1

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  No customers yet.
                </TableCell>
              </TableRow>
            )}
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.full_name ?? "—"}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">
                  {c.total_points}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <PageLink
          href={`/admin/customers?page=${pageNum - 1}`}
          disabled={pageNum <= 1}
        >
          Previous
        </PageLink>
        <span className="text-muted-foreground text-sm">Page {pageNum}</span>
        <PageLink
          href={`/admin/customers?page=${pageNum + 1}`}
          disabled={!hasNext}
        >
          Next
        </PageLink>
      </div>
    </div>
  )
}
