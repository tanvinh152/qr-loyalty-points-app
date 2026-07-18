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

export const metadata = { title: "Transactions" }

const PAGE_SIZE = 20

type TxRow = {
  id: string
  points: number
  created_at: string
  customers: { full_name: string | null; phone: string } | null
  orders: { order_code: string } | null
}

export default async function TransactionsPage({
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
    .from("point_transactions")
    .select("id, points, created_at, customers(full_name, phone), orders(order_code)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to)

  const rows = (data ?? []) as unknown as TxRow[]
  const hasNext = (count ?? 0) > to + 1

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Transaction History</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  No transactions yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {t.customers?.full_name ?? t.customers?.phone ?? "—"}
                </TableCell>
                <TableCell>{t.orders?.order_code ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">+{t.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <PageLink
          href={`/admin/transactions?page=${pageNum - 1}`}
          disabled={pageNum <= 1}
        >
          Previous
        </PageLink>
        <span className="text-muted-foreground text-sm">Page {pageNum}</span>
        <PageLink
          href={`/admin/transactions?page=${pageNum + 1}`}
          disabled={!hasNext}
        >
          Next
        </PageLink>
      </div>
    </div>
  )
}
