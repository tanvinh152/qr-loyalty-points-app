"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import { saveProductPoint, type SaveState } from "./actions"
import type { ProductPointRow } from "@/lib/db-types"

// Doubles as the "add" form (no row) and the per-row edit form.
export function ProductForm({ row }: { row?: ProductPointRow }) {
  const t = useT()
  const m = t.admin.products
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    saveProductPoint,
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
    <form action={formAction} className="grid gap-3 sm:grid-cols-5 sm:items-end">
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="grid gap-1">
        <Label htmlFor={`product_code-${suffix}`} className="text-xs">
          {m.productCode}
        </Label>
        <Input
          id={`product_code-${suffix}`}
          name="product_code"
          defaultValue={row?.product_code ?? ""}
          placeholder="SP000001"
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`label-${suffix}`} className="text-xs">
          {m.label}
        </Label>
        <Input id={`label-${suffix}`} name="label" defaultValue={row?.label ?? ""} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`points_awarded-${suffix}`} className="text-xs">
          {m.pointsAwarded}
        </Label>
        <Input
          id={`points_awarded-${suffix}`}
          name="points_awarded"
          type="number"
          min="0"
          step="1"
          defaultValue={row?.points_awarded ?? 0}
          required
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
