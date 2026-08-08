"use client"

import { useState, useTransition } from "react"
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/provider"
import { checkIn } from "./actions"

/**
 * Daily check-in button, embedded in the dashboard's SectionCard (server
 * component — the card frame and copy stay server-rendered; only the button's
 * pending/done state needs to be a client island).
 */
export function CheckinButton({
  initialCheckedIn,
}: {
  initialCheckedIn: boolean
}) {
  const t = useT()
  const d = t.customer.dashboard
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn)
  const [isPending, startTransition] = useTransition()

  function handleCheckIn() {
    startTransition(async () => {
      const res = await checkIn()
      if (!res.ok) {
        // Already checked in is not a failure worth alarming over — someone
        // else's tab or a retried request got there first.
        if (res.code === "already_checked_in") setCheckedIn(true)
        else toast.error(res.error)
        return
      }
      setCheckedIn(true)
      toast.success(d.checkinSuccess(res.pointsAwarded))
    })
  }

  if (checkedIn) {
    return (
      <Button type="button" size="lg" disabled>
        <CheckCircle2 className="size-5" aria-hidden />
        {d.checkinDone}
      </Button>
    )
  }

  return (
    <Button type="button" size="lg" onClick={handleCheckIn} disabled={isPending}>
      {isPending ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : (
        <CalendarCheck className="size-5" aria-hidden />
      )}
      {isPending ? d.checkinPending : d.checkinCta}
    </Button>
  )
}
