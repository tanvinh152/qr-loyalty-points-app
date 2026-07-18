import type { Rounding } from "@/lib/points"

export type OrderStatus = "pending" | "claimed"

export type PointSettingsRow = {
  id: string
  conversion_rate: number
  min_order_value: number
  rounding: Rounding
  is_active: boolean
  updated_at: string
}

export type OrderRow = {
  id: string
  order_code: string
  total: number
  status: OrderStatus
  external_order_id: string | null
  created_at: string
}

export type CustomerRow = {
  id: string
  phone: string
  email: string | null
  full_name: string | null
  total_points: number
  created_at: string
}

export type PointTransactionRow = {
  id: string
  customer_id: string
  order_id: string
  points: number
  created_at: string
}

export type ClaimResult = {
  points_awarded: number
  total_points: number
}
