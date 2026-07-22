"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/provider"

/**
 * Trash button guarded by a confirmation dialog. Deletes are irreversible and
 * used to fire on a single click, so nothing may call the action directly.
 *
 * `onConfirm` is a server action bound to the row id; it resolves to an error
 * message, or to nothing when the delete succeeded.
 */
export function ConfirmDelete({
  name,
  onConfirm,
  title,
  description,
}: {
  /** Shown in the confirmation copy so the user can tell rows apart. */
  name: string
  onConfirm: () => Promise<string | void>
  title?: string
  description?: string
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      const error = await onConfirm()
      if (error) {
        toast.error(error)
        return
      }
      toast.success(t.common.deleted)
      setOpen(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="icon-sm"
            type="button"
            aria-label={`${t.common.delete} — ${name}`}
          />
        }
      >
        <Trash2 aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title ?? t.common.confirmDeleteTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t.common.confirmDeleteBody(name)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={confirm}
            disabled={isPending}
          >
            {isPending ? t.common.deleting : t.common.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
