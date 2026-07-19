"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import { saveSettings, type SaveState } from "./actions"
import type { Rounding } from "@/lib/points"

type Props = {
  initial: {
    rounding: Rounding
    unmapped_sku_points: number
    claimable_statuses: string
  }
}

export function SettingsForm({ initial }: Props) {
  const t = useT()
  const s = t.admin.settings
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    saveSettings,
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

  return (
    <form action={formAction} className="grid max-w-sm gap-4">
      <div className="grid gap-2">
        <Label htmlFor="rounding">{s.rounding}</Label>
        <select
          id="rounding"
          name="rounding"
          defaultValue={initial.rounding}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="floor">{s.floor}</option>
          <option value="round">{s.round}</option>
          <option value="ceil">{s.ceil}</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="claimable_statuses">{s.claimableStatuses}</Label>
        <Input
          id="claimable_statuses"
          name="claimable_statuses"
          defaultValue={initial.claimable_statuses}
          required
        />
        <p className="text-muted-foreground text-xs">{s.claimableStatusesHelper}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="unmapped_sku_points">{s.unmappedSkuPoints}</Label>
        <Input
          id="unmapped_sku_points"
          name="unmapped_sku_points"
          type="number"
          step="1"
          min="0"
          defaultValue={initial.unmapped_sku_points}
          required
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? t.common.saving : s.save}
      </Button>
    </form>
  )
}
