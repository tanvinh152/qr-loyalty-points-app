"use client"

import { TriangleAlert } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/provider"

/**
 * The root error boundary — what catches a throw on the auth and public
 * routes, which sit outside the `(account)` and `/admin` boundaries and used
 * to fall through to Next's default page. A Client Component because Next
 * only calls `reset` from the browser. The error itself is deliberately not
 * shown: it can carry query text or ids that do not belong on screen.
 */
export default function RootError({ reset }: { reset: () => void }) {
  const t = useT()
  return (
    <main className="bg-canvas grid min-h-svh place-items-center p-4">
      <div className="border-border bg-card shadow-soft w-full max-w-md rounded-3xl border">
        <EmptyState
          icon={TriangleAlert}
          title={t.common.errorTitle}
          description={t.common.errorBody}
          action={
            <Button type="button" variant="secondary" onClick={reset}>
              {t.common.retry}
            </Button>
          }
        />
      </div>
    </main>
  )
}
