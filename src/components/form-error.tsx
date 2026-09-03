"use client"

import { useEffect, useRef } from "react"
import { AnimatePresence, m } from "motion/react"
import { AlertCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { T } from "@/lib/motion/tokens"

/**
 * The filled error banner the auth and claim forms show above their submit
 * button. Renders nothing when there is no message, so callers can pass a
 * possibly-null server error straight through.
 *
 * A client component now, for two things a server one could not do. It moves
 * in and out with a beat instead of a cut, and it TAKES FOCUS when a message
 * arrives: on the six-field register form the banner lands below the fold,
 * and `role="alert"` (which `ui/alert` sets) only announces — it does not
 * scroll. Focus does both.
 */
export function FormError({ message }: { message?: string | null }) {
  const ref = useRef<HTMLDivElement>(null)

  // Keyed on the text: a resubmission that fails with the SAME message keeps
  // focus where it is. A per-submission counter would refocus every time, but
  // it has to be read during render and the hooks lint forbids that; the
  // repeat case is rare enough not to fight the rule for.
  useEffect(() => {
    if (message) ref.current?.focus()
  }, [message])

  return (
    <AnimatePresence initial={false}>
      {message && (
        <m.div
          key="form-error"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, transition: T.quick }}
          exit={{ opacity: 0, y: -4, transition: T.exit }}
        >
          <Alert
            ref={ref}
            tabIndex={-1}
            variant="destructive"
            className="bg-destructive-container/60 border-transparent px-4 py-3 outline-none"
          >
            <AlertCircle aria-hidden />
            <AlertDescription className="text-destructive text-body-sm">
              {message}
            </AlertDescription>
          </Alert>
        </m.div>
      )}
    </AnimatePresence>
  )
}
