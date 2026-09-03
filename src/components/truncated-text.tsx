"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// Tailwind cannot build a class name from a variable, so the clamp depths that
// callers are allowed to ask for are spelled out.
const CLAMP = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
} as const

/**
 * Clamps text to `lines` and reveals the rest in a tooltip — but only when the
 * text is actually clipped. A label that fits gets no hover target and no tab
 * stop, so the tooltip never fires on the 90% of rows that are short.
 *
 * Pair it with a `max-w-[…]` on the containing `TableCell`: the cap is what
 * bounds the width, this is what makes the overflow readable.
 */
export function TruncatedText({
  children,
  tooltip,
  lines = 2,
  focusable = true,
  side = "top",
  className,
}: {
  children: React.ReactNode
  /** Full text for the tooltip. Defaults to `children` when it is a string. */
  tooltip?: string
  lines?: keyof typeof CLAMP
  /**
   * Set false when `children` already contains something focusable (a Link) —
   * otherwise the same cell takes two tab stops.
   */
  focusable?: boolean
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [clipped, setClipped] = useState(false)
  const full = tooltip ?? (typeof children === "string" ? children : undefined)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    // A line clamp keeps the whole content in the box and hides what spills, so
    // "clipped" is exactly "the scroll height outgrew the clamped height".
    setClipped(el.scrollHeight > el.clientHeight + 1)
  }, [])

  useLayoutEffect(() => {
    measure()
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure, full, lines])

  const revealable = clipped && Boolean(full)

  const label = (
    <span
      ref={ref}
      tabIndex={revealable && focusable ? 0 : undefined}
      className={cn(
        // TableCell keeps `whitespace-nowrap` so numbers, dates and badges
        // never break; undoing it here is what lets the clamp engage.
        "w-full break-words whitespace-normal",
        CLAMP[lines],
        className,
      )}
    >
      {children}
    </span>
  )

  // The span is returned bare when there is nothing to reveal, rather than
  // wrapped in a disabled trigger: Radix's Tooltip.Trigger has no `disabled`
  // prop at all, so the flag would have been spread onto the <span> as an
  // invalid DOM attribute AND the tooltip would still have fired. The measuring
  // ref rides on `label`, so it is attached either way.
  if (!revealable) return label

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent
        side={side}
        className="block max-w-sm text-left whitespace-normal"
      >
        {full}
      </TooltipContent>
    </Tooltip>
  )
}
