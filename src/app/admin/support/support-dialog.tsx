"use client"

import { useState, useTransition } from "react"
import { CheckCheck, Mail, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/provider"
import type { SupportRequestRow } from "@/lib/db-types"
import { setSupportStatus } from "./actions"

/**
 * Reads one ticket in full and toggles its status. The table can only show a
 * truncated message — a support request is free text up to 2000 characters, so
 * the whole thing lives behind this dialog.
 */
export function SupportDialog({
  row,
  receivedAt,
}: {
  row: SupportRequestRow
  /** Pre-formatted on the server: the locale lives there, not in the client. */
  receivedAt: string
}) {
  const t = useT()
  const s = t.admin.support
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const closed = row.status === "closed"
  const next = closed ? "open" : "closed"

  function toggle() {
    startTransition(async () => {
      const state = await setSupportStatus(row.id, next)
      if (!state.ok) {
        toast.error(state.message)
        return
      }
      toast.success(state.message)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" type="button">
            {s.view}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {s.viewTitle}
            <Badge variant={closed ? "muted" : "warning"}>
              {s.statuses[row.status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {t.customer.help.topics[
              row.topic as keyof typeof t.customer.help.topics
            ] ?? row.topic}{" "}
            · {receivedAt}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-0.5">
            <p className="text-body-sm font-semibold">{row.name}</p>
            <p className="text-muted-foreground text-body-sm">{row.email}</p>
          </div>
          {/* The customer typed line breaks; keep them rather than collapsing
              the message into one paragraph. */}
          <p className="bg-surface-container text-body-sm rounded-xl p-4 whitespace-pre-wrap">
            {row.message}
          </p>
        </div>

        <DialogFooter>
          <a
            href={`mailto:${row.email}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Mail aria-hidden />
            {s.replyTo}
          </a>
          <Button
            type="button"
            variant={closed ? "outline" : "default"}
            onClick={toggle}
            disabled={isPending}
          >
            {closed ? <RotateCcw aria-hidden /> : <CheckCheck aria-hidden />}
            {closed ? s.reopen : s.markClosed}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
