import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import type { RewardRow } from "@/lib/db-types"
import { RewardForm } from "./reward-form"
import { deleteReward } from "./actions"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.rewards.metaTitle }
}

export default async function RewardsPage() {
  const t = await getMessages()
  const m = t.admin.rewards
  const supabase = await createClient()
  const { data } = await supabase
    .from("rewards")
    .select("*")
    .order("points_cost", { ascending: true })

  const rewards = (data ?? []) as RewardRow[]

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-muted-foreground text-sm">{m.helper}</p>
      </div>

      <div className="grid gap-4">
        {rewards.length === 0 && (
          <p className="text-muted-foreground text-sm">{m.empty}</p>
        )}
        {rewards.map((reward) => (
          <div key={reward.id} className="grid gap-2 rounded-md border p-4">
            <RewardForm row={reward} />
            <form action={deleteReward} className="justify-self-end">
              <input type="hidden" name="id" value={reward.id} />
              <Button type="submit" variant="outline" size="sm">
                {t.common.delete}
              </Button>
            </form>
          </div>
        ))}
      </div>

      <div className="grid gap-2 rounded-md border border-dashed p-4">
        <h2 className="text-sm font-medium">{m.addTitle}</h2>
        <RewardForm />
      </div>
    </div>
  )
}
