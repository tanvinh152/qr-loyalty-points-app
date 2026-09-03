"use client"

import { useState, useTransition } from "react"
import { CalendarCheck, CheckCircle2 } from "lucide-react"

import { Celebration } from "@/components/celebration"
import { PendingIcon } from "@/components/pending-icon"
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
  // Only a check-in made HERE celebrates. One found already done — on load,
  // or because another tab got there first — is a state, not an event.
  const [celebrate, setCelebrate] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCheckIn() {
    if (checkedIn) return
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
      setCelebrate(true)
      toast.success(d.checkinSuccess(res.pointsAwarded))
    })
  }

  // ONE button for both states, so the done state arrives as a colour change
  // and an icon cross-fade rather than a different element popping in. Done is
  // `aria-disabled`, not `disabled`: a disabled button is painted at 40%, which
  // would dim the very burst the member just earned.
  return (
    <Button
      type="button"
      size="lg"
      variant={checkedIn ? "muted" : "default"}
      onClick={handleCheckIn}
      disabled={isPending}
      aria-disabled={checkedIn || undefined}
      className={checkedIn ? "cursor-default" : undefined}
    >
      {checkedIn ? (
        <Celebration fire={celebrate} className="size-5">
          <CheckCircle2 className="size-5" aria-hidden />
        </Celebration>
      ) : (
        <PendingIcon pending={isPending} className="size-5">
          <CalendarCheck className="size-5" aria-hidden />
        </PendingIcon>
      )}
      {checkedIn ? d.checkinDone : isPending ? d.checkinPending : d.checkinCta}
    </Button>
  )
}
