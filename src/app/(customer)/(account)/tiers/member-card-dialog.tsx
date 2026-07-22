"use client"

import { CreditCard, PawPrint } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FormDialog } from "@/components/form-dialog"
import { useT } from "@/lib/i18n/provider"

/**
 * "Digital card" from the member mockups. Everything on it already exists on the
 * customer row, so the card is a presentation of state, not a new record — there
 * is no barcode or pass file behind it.
 */
export function MemberCardDialog({
  name,
  tierName,
  points,
  memberSince,
  phone,
}: {
  name: string
  tierName: string
  points: number
  memberSince: string
  /** Already masked by the caller — this component never sees the full number. */
  phone: string
}) {
  const t = useT()
  const ti = t.customer.tiers

  return (
    <FormDialog
      title={ti.cardTitle}
      description={ti.cardBody}
      trigger={
        <Button type="button" variant="muted" className="w-fit rounded-full">
          <CreditCard className="size-4" aria-hidden />
          {ti.cardCta}
        </Button>
      }
    >
      {() => (
        <div className="border-tier/40 bg-surface-container relative grid gap-6 overflow-hidden rounded-3xl border p-6">
          <span
            aria-hidden
            className="bg-tier/20 pointer-events-none absolute -top-12 -right-12 size-40 rounded-full blur-3xl"
          />
          <div className="relative flex items-center justify-between gap-4">
            <span className="text-label-md text-tier uppercase">
              {tierName}
            </span>
            <PawPrint className="text-tier size-6" aria-hidden />
          </div>
          <div className="relative grid gap-1">
            <span className="text-headline-md">{name}</span>
            <span className="text-body-sm text-muted-foreground tabular-nums">
              {phone}
            </span>
          </div>
          <div className="relative flex items-end justify-between gap-4">
            <div className="grid">
              <span className="text-label-md text-muted-foreground uppercase">
                {t.customer.dashboard.lifetimeLabel}
              </span>
              <span className="text-headline-md text-primary tabular-nums">
                {points.toLocaleString()}
              </span>
            </div>
            <span className="text-body-xs text-muted-foreground">
              {ti.memberSince(memberSince)}
            </span>
          </div>
        </div>
      )}
    </FormDialog>
  )
}
