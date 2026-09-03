import Link from "next/link"
import { Compass } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/server"
import { ENTER } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

/**
 * The app-wide 404, in the app's own voice. Before this a dead link — or the
 * `notFound()` an admin customer page throws for an unknown id — landed on
 * Next's bare default. Home is `/`, which the proxy routes on from by role.
 */
export default async function NotFound() {
  const t = await getMessages()
  return (
    <main className="bg-canvas grid min-h-svh place-items-center p-4">
      <div
        className={cn(
          ENTER,
          "border-border bg-card shadow-soft w-full max-w-md rounded-3xl border",
        )}
      >
        <EmptyState
          icon={Compass}
          title={t.common.notFoundTitle}
          description={t.common.notFoundBody}
          action={
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              {t.common.goHome}
            </Link>
          }
        />
      </div>
    </main>
  )
}
