"use client"

import { useLinkStatus } from "next/link"

import { cn } from "@/lib/utils"

/**
 * The dot a filter chip or a pager button shows while its navigation is in
 * flight. Server-rendered lists (the shop's category chips, the ledger's
 * pages) navigate on a search-param change, and until the new page streams in
 * nothing on screen said the click had landed.
 *
 * Must sit INSIDE a `<Link>` — `useLinkStatus` reads the nearest one.
 *
 * Always rendered and toggled by opacity, never mounted on demand: an inline
 * indicator that appears is a layout shift on the very control being pressed.
 * The 150ms delay keeps it invisible on a prefetched or fast navigation, so it
 * only ever shows when there was genuinely something to wait for.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      data-pending={pending}
      className={cn(
        "bg-current duration-quick inline-block size-1.5 shrink-0 rounded-full opacity-0 transition-opacity delay-150 data-[pending=true]:opacity-100",
        className,
      )}
    />
  )
}
