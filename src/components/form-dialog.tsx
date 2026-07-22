"use client"

import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * Dialog chrome for the admin create/edit forms. It owns the open state and
 * hands `close` to the form, which calls it once the server action succeeds —
 * a failed save keeps the dialog open so the errors stay visible.
 */
export function FormDialog({
  trigger,
  title,
  description,
  className,
  children,
}: {
  /** Rendered inside `DialogTrigger` — usually a `Button`. */
  trigger: React.ReactNode
  title: string
  description?: string
  className?: string
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={trigger as React.ReactElement<Record<string, unknown>>}
      />
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  )
}
