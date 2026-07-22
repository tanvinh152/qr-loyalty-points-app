import { Info } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { SettingsForm } from "./settings-form"
import { DEFAULT_CLAIMABLE_STATUSES } from "@/lib/pancake/order-status"
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
    // Nothing saved yet -> pre-tick the recommended set rather than a bare [3],
    // which would reject every order that has moved on to "received_money".
    claimable_statuses: data?.claimable_statuses ?? DEFAULT_CLAIMABLE_STATUSES,
  }

  return (
    <div className="grid gap-6">
      <PageHeader title={s.title} description={s.helper} />
      <Alert className="bg-surface-container/60 border-border px-4 py-3">
        <Info aria-hidden />
        <AlertDescription>{s.formulaExample}</AlertDescription>
      </Alert>
      <SettingsForm initial={initial} />
    </div>
  )
}
