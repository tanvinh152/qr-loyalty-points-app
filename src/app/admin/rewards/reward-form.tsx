"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import { saveReward, type SaveState } from "./actions"
import type { RewardRow } from "@/lib/db-types"

// Doubles as the "add" form (no row) and the per-row edit form.
export function RewardForm({ row }: { row?: RewardRow }) {
  const t = useT()
  const m = t.admin.rewards
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    saveReward,
    null
  )
  const lastState = useRef<SaveState>(null)

  useEffect(() => {
    if (state && state !== lastState.current) {
      lastState.current = state
      if (state.ok) toast.success(state.message)
      else toast.error(state.message)
    }
  }, [state])

  const suffix = row?.id ?? "new"

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-6 sm:items-end">
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="grid gap-1">
        <Label htmlFor={`name-${suffix}`} className="text-xs">
          {m.name}
        </Label>
        <Input id={`name-${suffix}`} name="name" defaultValue={row?.name ?? ""} required />
      </div>
      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor={`description-${suffix}`} className="text-xs">
          {m.description}
        </Label>
        <Input
          id={`description-${suffix}`}
          name="description"
          defaultValue={row?.description ?? ""}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`points_cost-${suffix}`} className="text-xs">
          {m.pointsCost}
        </Label>
        <Input
          id={`points_cost-${suffix}`}
          name="points_cost"
          type="number"
          min="0"
          step="1"
          defaultValue={row?.points_cost ?? 0}
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`quantity-${suffix}`} className="text-xs">
          {m.quantity}
        </Label>
        <Input
          id={`quantity-${suffix}`}
          name="quantity"
          type="number"
          min="0"
          step="1"
          defaultValue={row?.quantity ?? 0}
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`image_url-${suffix}`} className="text-xs">
          {m.imageUrl}
        </Label>
        <Input
          id={`image_url-${suffix}`}
          name="image_url"
          defaultValue={row?.image_url ?? ""}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={row?.is_active ?? true}
          className="size-4"
        />
        {m.status}
      </label>
      <Button type="submit" disabled={isPending}>
        {isPending ? t.common.saving : row ? t.common.save : t.common.add}
      </Button>
    </form>
  )
}
