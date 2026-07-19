"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import { saveTier, type SaveState } from "./actions"
import type { MembershipTierRow } from "@/lib/db-types"

// Doubles as the "add" form (no row) and the per-row edit form.
export function TierForm({ row }: { row?: MembershipTierRow }) {
  const t = useT()
  const m = t.admin.tiers
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    saveTier,
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
    <form action={formAction} className="grid gap-3 sm:grid-cols-6 sm:items-end">
      {row && <input type="hidden" name="id" value={row.id} />}
      <Field label={m.name} name="name" defaultValue={row?.name ?? ""} required />
      <Field
        label={m.threshold}
        name="threshold"
        type="number"
        min="0"
        step="1"
        defaultValue={row?.threshold ?? 0}
        required
      />
      <Field
        label={m.multiplier}
        name="multiplier"
        type="number"
        min="0.1"
        step="0.1"
        defaultValue={row?.multiplier ?? 1}
        required
      />
      <Field
        label={m.sortOrder}
        name="sort_order"
        type="number"
        min="0"
        step="1"
        defaultValue={row?.sort_order ?? 0}
        required
      />
      <Field label={m.benefits} name="benefits" defaultValue={row?.benefits ?? ""} />
      <Button type="submit" disabled={isPending}>
        {isPending ? t.common.saving : row ? t.common.save : t.common.add}
      </Button>
    </form>
  )
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  const id = `${name}-${props.defaultValue ?? "new"}`
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} name={name} {...props} />
    </div>
  )
}
