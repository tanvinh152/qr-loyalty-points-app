import Link from "next/link"
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Inbox,
  Medal,
  Package,
  Plus,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { InitialsAvatar } from "@/components/initials-avatar"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { SectionCard } from "@/components/section-card"
import { StatCard } from "@/components/stat-card"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { getSupportCounts } from "@/lib/support"
import { LOW_STOCK } from "@/lib/rewards"
import type {
  MembershipTierRow,
  TransactionRow,
  TransactionType,
} from "@/lib/db-types"

const RECENT_LIMIT = 5

type RecentRow = {
  id: string
  customer_id: string
  type: TransactionType
  amount: number
  created_at: string
  customers: {
    full_name: string | null
    phone: string
    current_points: number
    membership_tiers: { name: string } | null
  } | null
}

export default async function AdminDashboard() {
  const t = await getMessages()
  const d = t.admin.dashboard
  const supabase = await createClient()

  const [
    customers,
    transactions,
    ledger,
    tiers,
    recent,
    lowStock,
    supportCounts,
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("transactions").select("*", { count: "exact", head: true }),
    // Issued/redeemed totals need the amounts, not just a count.
    supabase.from("transactions").select("type, amount"),
    supabase
      .from("membership_tiers")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: false }),
    // The mockup's "recent customer activity" strip — newest movements only.
    supabase
      .from("transactions")
      .select(
        "id, customer_id, type, amount, created_at, customers(full_name, phone, current_points, membership_tiers(name))",
      )
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
    // Same threshold the reward list badges as "running low".
    supabase
      .from("rewards")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .lte("quantity", LOW_STOCK),
    getSupportCounts(),
  ])

  const rows = (ledger.data ?? []) as Pick<TransactionRow, "type" | "amount">[]
  const issued = rows.reduce(
    (sum, r) => (r.amount > 0 ? sum + r.amount : sum),
    0,
  )
  const redeemed = rows.reduce(
    (sum, r) => (r.amount < 0 ? sum - r.amount : sum),
    0,
  )

  // Tier distribution: one head-count per tier. Tiers are a handful of rows, so
  // this stays cheaper than pulling every customer just to group them.
  const tierRows = (tiers.data ?? []) as Pick<
    MembershipTierRow,
    "id" | "name" | "sort_order"
  >[]
  const tierCounts = await Promise.all(
    tierRows.map(async (tier) => {
      const { count } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("tier_id", tier.id)
      return { ...tier, count: count ?? 0 }
    }),
  )
  const largestTier = Math.max(1, ...tierCounts.map((tier) => tier.count))
  const recentRows = (recent.data ?? []) as unknown as RecentRow[]

  const stats = [
    {
      label: d.customers,
      hint: d.customersHint,
      value: customers.count ?? 0,
      icon: Users,
      tone: "primary" as const,
    },
    {
      label: d.transactions,
      hint: d.transactionsHint,
      value: transactions.count ?? 0,
      icon: Receipt,
      tone: "neutral" as const,
    },
    {
      label: d.pointsIssued,
      hint: d.pointsIssuedHint,
      value: issued,
      icon: TrendingUp,
      tone: "secondary" as const,
    },
    {
      label: d.pointsRedeemed,
      hint: d.pointsRedeemedHint,
      value: redeemed,
      icon: Gift,
      tone: "primary" as const,
    },
    // The two tiles that ask for an action rather than reporting a total, so
    // both link straight to the screen that resolves them.
    {
      label: d.openTickets,
      hint: d.openTicketsHint,
      value: supportCounts.open,
      icon: Inbox,
      tone: "secondary" as const,
      href: "/admin/support",
      highlight: supportCounts.open > 0,
    },
    {
      label: d.lowStock,
      hint: d.lowStockHint(LOW_STOCK),
      value: lowStock.count ?? 0,
      icon: AlertTriangle,
      tone: "neutral" as const,
      href: "/admin/rewards",
    },
  ]

  const quickActions = [
    { href: "/admin/rewards", label: d.addReward, icon: Gift },
    { href: "/admin/tiers", label: d.addTier, icon: Medal },
    { href: "/admin/products", label: d.addProduct, icon: Package },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader title={d.title} description={d.subtitle}>
        <SearchInput
          action="/admin/customers"
          label={d.searchLabel}
          placeholder={d.searchPlaceholder}
        />
      </PageHeader>

      <nav aria-label={d.quickActions} className="flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            // Base UI's Button has no `asChild`, so a link that looks like a
            // button borrows the variants directly.
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Plus aria-hidden />
            <action.icon aria-hidden />
            {action.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            hint={s.hint}
            icon={s.icon}
            tone={s.tone}
            href={s.href}
            highlight={s.highlight}
          />
        ))}
      </div>

      <SectionCard
        title={d.tierDistribution}
        actions={
          <Link
            href="/admin/tiers"
            className="text-primary text-label-md hover:underline"
          >
            {d.viewAllTiers}
          </Link>
        }
        bodyClassName="grid gap-6 p-6"
      >
        {tierCounts.length === 0 && (
          <EmptyState title={d.noTiers} icon={Users} />
        )}
        {tierCounts.map((tier) => (
          <div key={tier.id} className="grid gap-2">
            <div className="flex justify-between">
              <span className="text-label-md">{tier.name}</span>
              <span className="text-label-md text-muted-foreground tabular-nums">
                {d.tierMembers(tier.count)}
              </span>
            </div>
            <Progress value={tier.count / largestTier} label={tier.name} />
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title={d.recent}
        actions={
          <Link
            href="/admin/transactions"
            className="text-primary text-label-md hover:underline"
          >
            {d.viewAllTransactions}
          </Link>
        }
      >
        {recentRows.length === 0 ? (
          <EmptyState title={d.noRecent} icon={Receipt} />
        ) : (
          // The same movement row the customer dashboard uses, so a credit and a
          // debit read identically in both portals. A five-row strip does not
          // need a table's column headers.
          <ul className="divide-border divide-y">
            {recentRows.map((row) => {
              const credit = row.amount >= 0
              const name =
                row.customers?.full_name ?? row.customers?.phone ?? "—"
              return (
                <li key={row.id}>
                  <Link
                    href={`/admin/customers/${row.customer_id}`}
                    className="hover:bg-surface-container flex items-center justify-between gap-4 px-6 py-4 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "bg-surface-container grid size-11 shrink-0 place-items-center rounded-xl",
                          credit ? "text-secondary" : "text-destructive",
                        )}
                      >
                        {credit ? (
                          <ArrowUpRight className="size-5" aria-hidden />
                        ) : (
                          <ArrowDownLeft className="size-5" aria-hidden />
                        )}
                      </span>
                      <InitialsAvatar name={name} />
                      <div className="min-w-0">
                        <p className="text-body-sm truncate font-semibold">
                          {name}
                        </p>
                        <p className="text-muted-foreground text-body-xs">
                          {row.customers?.phone ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {row.customers?.membership_tiers && (
                        <Badge variant="secondary" className="hidden sm:flex">
                          {row.customers.membership_tiers.name}
                        </Badge>
                      )}
                      <div className="text-right">
                        <span
                          className={cn(
                            "text-headline-md font-bold tabular-nums",
                            credit ? "text-secondary" : "text-destructive",
                          )}
                        >
                          {d.movement(row.amount)}
                        </span>
                        <p className="text-label-sm text-muted-foreground uppercase">
                          {d.colBalance}:{" "}
                          {(
                            row.customers?.current_points ?? 0
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
