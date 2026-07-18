// Single source of truth for point calculation on the TS side.
// MUST match the SQL logic in supabase/migrations/0003_claim_rpc.sql.
// The RPC recomputes server-side and is authoritative; this is for UI preview only.

export type Rounding = "floor" | "round" | "ceil"

export type PointSettings = {
  conversion_rate: number
  min_order_value: number
  rounding: Rounding
}

export function calcPoints(orderTotal: number, settings: PointSettings): number {
  if (orderTotal < settings.min_order_value) return 0
  const raw = orderTotal * settings.conversion_rate
  switch (settings.rounding) {
    case "floor":
      return Math.floor(raw)
    case "ceil":
      return Math.ceil(raw)
    default:
      return Math.round(raw)
  }
}
