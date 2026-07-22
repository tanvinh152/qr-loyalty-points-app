"use client"

import { TriangleAlert } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/provider"

/**
 * Route-level error boundary. It must be a Client Component — Next only calls
 * `reset` from the browser. The error itself is deliberately not shown: it can
 * carry query text or ids that do not belong on screen.
 */
export default function AccountError({ reset }: { reset: () => void }) {
  const t = useT()
  return (
    <div className="border-border bg-card rounded-xl border">
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
  )
}
