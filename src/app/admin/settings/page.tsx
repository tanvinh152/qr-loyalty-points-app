import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { SettingsForm } from "./settings-form"
import type { Rounding } from "@/lib/points"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.settings.metaTitle }
}

export default async function SettingsPage() {
  const t = await getMessages()
  const s = t.admin.settings
  const supabase = await createClient()
  const { data } = await supabase
    .from("loyalty_settings")
    .select("rounding, claimable_statuses, unmapped_sku_points")
    .eq("is_active", true)
    .maybeSingle()

  const initial = {
    rounding: (data?.rounding ?? "floor") as Rounding,
    unmapped_sku_points: data?.unmapped_sku_points ?? 0,
    claimable_statuses: (data?.claimable_statuses ?? [3]).join(", "),
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{s.title}</h1>
      <p className="text-muted-foreground text-sm">{s.helper}</p>
      <SettingsForm initial={initial} />
    </div>
  )
}
