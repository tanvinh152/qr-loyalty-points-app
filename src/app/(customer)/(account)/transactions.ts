import type { TransactionListRow } from "@/lib/loyalty"
import type { Messages } from "@/lib/i18n/messages"

// Ledger-row derivations shared by /history and the dashboard's activity table.
// Both screens show the same rows, so the code and the label have to be built in
// one place — before this module they were a `map` inside history/page.tsx, and
// the dashboard had already drifted into naming redemptions differently.

/**
 * The reference shown beside a row. The ledger has no transaction-code column,
 * so it is derived from the row id, which is stable and unique already. Note
 * this is NOT what /history's search box matches — that runs on `order_code`.
 */
export function transactionCode(
  row: Pick<TransactionListRow, "id" | "type">,
): string {
  const prefix = row.type === "REDEEM" ? "RDM" : "TXN"
  return `${prefix}-${row.id.replace(/-/g, "").slice(-6).toUpperCase()}`
}

/**
 * What the row is called. The message bag is passed in rather than fetched so
 * this module stays synchronous and free of `server-only`; both callers already
 * hold `t.customer.history`.
 */
export function transactionTitle(
  row: Pick<TransactionListRow, "type" | "order_code" | "reward">,
  h: Messages["customer"]["history"],
): string {
  if (row.type === "EARN") return h.earn(row.order_code)
  // The join is already in `getTransactions`, so naming the actual reward costs
  // nothing and beats the generic fallback.
  if (row.type === "REDEEM") return row.reward?.name ?? h.redeem
  return h.adjust
}
