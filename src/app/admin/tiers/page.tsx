import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import type { MembershipTierRow } from "@/lib/db-types"
import { TierForm } from "./tier-form"
import { deleteTier } from "./actions"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.tiers.metaTitle }
}

export default async function TiersPage() {
  const t = await getMessages()
  const m = t.admin.tiers
  const supabase = await createClient()
  const { data } = await supabase
    .from("membership_tiers")
    .select("*")
    .order("threshold", { ascending: true })

  const tiers = (data ?? []) as MembershipTierRow[]

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-muted-foreground text-sm">{m.helper}</p>
      </div>

      <div className="grid gap-4">
        {tiers.length === 0 && (
          <p className="text-muted-foreground text-sm">{m.empty}</p>
        )}
        {tiers.map((tier) => (
          <div key={tier.id} className="grid gap-2 rounded-md border p-4">
            <TierForm row={tier} />
            <form action={deleteTier} className="justify-self-end">
              <input type="hidden" name="id" value={tier.id} />
              <Button type="submit" variant="outline" size="sm">
                {t.common.delete}
              </Button>
            </form>
          </div>
        ))}
      </div>

      <div className="grid gap-2 rounded-md border border-dashed p-4">
        <h2 className="text-sm font-medium">{m.addTitle}</h2>
        <TierForm />
      </div>
    </div>
  )
}
