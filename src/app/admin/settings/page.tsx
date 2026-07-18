import { createClient } from "@/lib/supabase/server"
import { SettingsForm } from "./settings-form"
import type { Rounding } from "@/lib/points"

export const metadata = { title: "Point Settings" }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("point_settings")
    .select("conversion_rate, min_order_value, rounding")
    .eq("is_active", true)
    .maybeSingle()

  const initial = {
    conversion_rate: data?.conversion_rate ?? 1,
    min_order_value: data?.min_order_value ?? 0,
    rounding: (data?.rounding ?? "round") as Rounding,
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Point Settings</h1>
      <p className="text-muted-foreground text-sm">
        Points = order total × conversion rate (rounded), when total ≥ minimum
        order value.
      </p>
      <SettingsForm initial={initial} />
    </div>
  )
}
