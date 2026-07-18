"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveSettings, type SaveState } from "./actions"
import type { Rounding } from "@/lib/points"

type Props = {
  initial: {
    conversion_rate: number
    min_order_value: number
    rounding: Rounding
  }
}

export function SettingsForm({ initial }: Props) {
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
        <Label htmlFor="conversion_rate">Conversion rate (points per unit)</Label>
        <Input
          id="conversion_rate"
          name="conversion_rate"
          type="number"
          step="0.01"
          min="0"
          defaultValue={initial.conversion_rate}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="min_order_value">Minimum order value</Label>
        <Input
          id="min_order_value"
          name="min_order_value"
          type="number"
          step="1"
          min="0"
          defaultValue={initial.min_order_value}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="rounding">Rounding</Label>
        <select
          id="rounding"
          name="rounding"
          defaultValue={initial.rounding}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="floor">Floor</option>
          <option value="round">Round</option>
          <option value="ceil">Ceil</option>
        </select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  )
}
