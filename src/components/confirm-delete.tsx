"use client"

import { useState, useTransition } from "react"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import { Trash2 } from "@/components/animate-ui/icons/trash-2"
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
 *
 * The copy and glyph are overridable so the same gate can guard any other
 * one-click destruction — cancelling a queued tier raise, say — without a
 * second dialog being written. The icon must be an Animate UI one: it is the
 * control's own affordance, so it animates on hover like the trash does.
 */
export function ConfirmDelete({
  name,
  onConfirm,
  title,
  description,
  icon: Icon = Trash2,
  triggerVariant = "destructive",
  triggerLabel,
  confirmLabel,
  pendingLabel,
  successMessage,
}: {
  /** Shown in the confirmation copy so the user can tell rows apart. */
  name: string
  onConfirm: () => Promise<string | void>
  title?: string
  description?: string
  icon?: typeof Trash2
  triggerVariant?: React.ComponentProps<typeof Button>["variant"]
  /** Accessible name of the trigger. Defaults to "Delete — {name}". */
  triggerLabel?: string
  confirmLabel?: string
  pendingLabel?: string
  successMessage?: string
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
      toast.success(successMessage ?? t.common.deleted)
      setOpen(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AnimateIcon animateOnHover asChild>
        <AlertDialogTrigger asChild>
          <Button
            variant={triggerVariant}
            size="icon-sm"
            type="button"
            aria-label={triggerLabel ?? `${t.common.delete} — ${name}`}
          >
            <Icon aria-hidden />
          </Button>
        </AlertDialogTrigger>
      </AnimateIcon>
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
            {isPending
              ? (pendingLabel ?? t.common.deleting)
              : (confirmLabel ?? t.common.delete)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
