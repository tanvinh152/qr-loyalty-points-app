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
import type { TransactionSource, TransactionType } from "@/lib/db-types"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.transactions.metaTitle }
}

const PAGE_SIZE = 20

type TxRow = {
  id: string
  type: TransactionType
  source: TransactionSource
  amount: number
  order_code: string | null
  created_at: string
  customers: { full_name: string | null; phone: string } | null
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const t = await getMessages()
  const tx = t.admin.transactions
  const { page } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data, count } = await supabase
    .from("transactions")
    .select(
      "id, type, source, amount, order_code, created_at, customers(full_name, phone)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to)

  const rows = (data ?? []) as unknown as TxRow[]
  const hasNext = (count ?? 0) > to + 1

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{tx.title}</h1>
      <div className="rounded-md border">
        <Table>
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
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  {tx.empty}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {row.customers?.full_name ?? row.customers?.phone ?? "—"}
                </TableCell>
                <TableCell>{row.order_code ?? "—"}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell className="text-muted-foreground">{row.source}</TableCell>
                <TableCell className="text-right font-medium">
                  {row.amount > 0 ? `+${row.amount}` : row.amount}
                </TableCell>
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
          {t.common.previous}
        </PageLink>
        <span className="text-muted-foreground text-sm">
          {t.common.page(pageNum)}
        </span>
        <PageLink
          href={`/admin/transactions?page=${pageNum + 1}`}
          disabled={!hasNext}
        >
          {t.common.next}
        </PageLink>
      </div>
    </div>
  )
}
