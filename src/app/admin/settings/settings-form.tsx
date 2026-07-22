"use client"

import { useActionState, useState } from "react"

import { useActionToast } from "@/hooks/use-action-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useT } from "@/lib/i18n/provider"
import {
  DEFAULT_CLAIMABLE_STATUSES,
  PANCAKE_ORDER_STATUSES,
  statusKey,
} from "@/lib/pancake/order-status"
import { saveSettings, type SaveState } from "./actions"
import type { Rounding } from "@/lib/points"

type Props = {
  initial: {
    rounding: Rounding
    unmapped_sku_points: number
    claimable_statuses: number[]
  }
}

export function SettingsForm({ initial }: Props) {
  const t = useT()
  const s = t.admin.settings
  const ps = t.pancakeStatus
  const [statuses, setStatuses] = useState<number[]>(initial.claimable_statuses)
  // Base UI renders the closed trigger from `items`, so the labels live here
  // rather than only on the options.
  const roundingItems: { label: string; value: Rounding }[] = [
    { value: "floor", label: `${s.floor} (${s.floorExample})` },
    { value: "round", label: `${s.round} (${s.roundExample})` },
    { value: "ceil", label: `${s.ceil} (${s.ceilExample})` },
  ]
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    saveSettings,
    null,
  )
  useActionToast(state)

  function toggle(code: number) {
    setStatuses((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-8">
      <fieldset className="grid gap-3">
        <div className="grid gap-1">
          <legend className="text-label-md">{s.claimableStatuses}</legend>
          <p className="text-muted-foreground text-body-sm">
            {s.claimableStatusesHelper}
          </p>
        </div>

        {/* The server action still parses a comma-separated string, so the
            checkbox state is mirrored into one hidden field. */}
        <input
          type="hidden"
          name="claimable_statuses"
          value={statuses.join(", ")}
        />

        <div className="grid gap-2 sm:grid-cols-2">
          {PANCAKE_ORDER_STATUSES.map((code) => {
            const key = statusKey(code)
            const status = key ? ps[key] : null
            const checked = statuses.includes(code)
            const recommended = DEFAULT_CLAIMABLE_STATUSES.includes(code)
            return (
              <label
                key={code}
                data-checked={checked || undefined}
                className="hover:bg-surface-container data-checked:border-primary data-checked:bg-accent flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(code)}
                  className="mt-0.5"
                />
                <span className="grid gap-1">
                  <span className="text-body-sm flex flex-wrap items-center gap-1.5 font-medium">
                    {status?.label ?? ps.unknown(code)}
                    <Badge variant="muted">{ps.code(code)}</Badge>
                    {recommended && (
                      <Badge variant="success">{s.recommended}</Badge>
                    )}
                  </span>
                  {status && (
                    <span className="text-muted-foreground text-body-xs">
                      {status.hint}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>

        <p
          className={
            statuses.length === 0
              ? "text-destructive text-body-sm"
              : "text-muted-foreground text-body-sm"
          }
        >
          {statuses.length === 0
            ? s.noStatusSelected
            : s.selectedCount(statuses.length)}
        </p>
      </fieldset>

      <fieldset className="grid gap-3">
        <div className="grid gap-1">
          <Label htmlFor="rounding">{s.rounding}</Label>
          <p className="text-muted-foreground text-body-sm">
            {s.roundingHelper}
          </p>
        </div>
        {/* The action reads `rounding` off the form, so the Select mirrors its
            value into a hidden field. */}
        <Select
          items={roundingItems}
          name="rounding"
          defaultValue={initial.rounding}
        >
          <SelectTrigger id="rounding" className="w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roundingItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>

      <fieldset className="grid gap-3">
        <div className="grid gap-1">
          <Label htmlFor="unmapped_sku_points">{s.unmappedSkuPoints}</Label>
          <p className="text-muted-foreground text-body-sm">
            {s.unmappedSkuPointsHelper}
          </p>
        </div>
        <Input
          id="unmapped_sku_points"
          name="unmapped_sku_points"
          type="number"
          step="1"
          min="0"
          defaultValue={initial.unmapped_sku_points}
          required
          className="h-11 max-w-sm"
        />
      </fieldset>

      <Button
        type="submit"
        size="lg"
        disabled={isPending || statuses.length === 0}
        className="justify-self-start"
      >
        {isPending ? t.common.saving : s.save}
      </Button>
    </form>
  )
}
