"use client"

import { useFormStatus } from "react-dom"

import { PendingIcon } from "@/components/pending-icon"
import { Button } from "@/components/ui/button"

/**
 * The submit for a form whose pending state lives in the form itself rather
 * than in a `useTransition` beside it — a plain GET filter form
 * (`next/form`'s `<Form>`), where the whole submission is a navigation and no
 * client code sees it start. `useFormStatus` does.
 *
 * Renders the same PendingIcon cross-fade every other button in the app uses,
 * so the ledger's "Filter" pends the way "Redeem" does.
 */
export function SubmitButton({
  icon,
  children,
  pendingLabel,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type" | "children"> & {
  /** The idle glyph; swapped for the spinner while the form is in flight. */
  icon?: React.ReactNode
  children: React.ReactNode
  /** Label while pending. Falls back to the idle label. */
  pendingLabel?: React.ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} {...props}>
      {icon !== undefined && (
        <PendingIcon pending={pending} className="size-4">
          {icon}
        </PendingIcon>
      )}
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </Button>
  )
}
