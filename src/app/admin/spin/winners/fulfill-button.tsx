"use client"

import { useTransition } from "react"
import { Hand, Loader2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/provider"
import { setSpinResultFulfilled } from "../actions"

/**
 * Marks a won gift as handed over at the counter, or puts it back in the queue.
 *
 * No confirmation dialog: unlike a delete this is reversible in one click, and
 * the undo is the same button. The server action revalidates, so the row's
 * status re-renders from the database rather than from local state.
 */
export function FulfillButton({
  id,
  fulfilled,
}: {
  id: string
  fulfilled: boolean
}) {
  const t = useT()
  const m = t.admin.spin.winners
  const [isPending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const res = await setSpinResultFulfilled(id, !fulfilled)
      if (!res?.ok) {
        toast.error(res?.message ?? m.updateFailed)
        return
      }
      toast.success(res.message)
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={fulfilled ? "ghost" : "secondary"}
      onClick={toggle}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : fulfilled ? (
        <Undo2 aria-hidden />
      ) : (
        <Hand aria-hidden />
      )}
      {fulfilled ? m.undoFulfilled : m.markFulfilled}
    </Button>
  )
}
