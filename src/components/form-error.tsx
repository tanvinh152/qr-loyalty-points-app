import { AlertCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * The filled error banner the auth and claim forms show above their submit
 * button. Renders nothing when there is no message, so callers can pass a
 * possibly-null server error straight through.
 */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <Alert
      variant="destructive"
      className="bg-destructive-container/60 border-transparent px-4 py-3"
    >
      <AlertCircle aria-hidden />
      <AlertDescription className="text-destructive text-body-sm">
        {message}
      </AlertDescription>
    </Alert>
  )
}
