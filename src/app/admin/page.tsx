import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import type { TransactionRow } from "@/lib/db-types"

export default async function AdminDashboard() {
  const t = await getMessages()
  const d = t.admin.dashboard
  const supabase = await createClient()

  const [customers, transactions, ledger] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("transactions").select("*", { count: "exact", head: true }),
    // Issued/redeemed totals need the amounts, not just a count.
    supabase.from("transactions").select("type, amount"),
  ])

  const rows = (ledger.data ?? []) as Pick<TransactionRow, "type" | "amount">[]
  const issued = rows.reduce((sum, r) => (r.amount > 0 ? sum + r.amount : sum), 0)
  const redeemed = rows.reduce((sum, r) => (r.amount < 0 ? sum - r.amount : sum), 0)

  const stats = [
    { label: d.customers, value: customers.count ?? 0 },
    { label: d.transactions, value: transactions.count ?? 0 },
    { label: d.pointsIssued, value: issued },
    { label: d.pointsRedeemed, value: redeemed },
  ]

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{d.title}</h1>
      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{s.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
