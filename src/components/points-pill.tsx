"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { animate, useReducedMotion } from "motion/react"
import { Sparkles } from "lucide-react"

import { COUNT_MS, EASE } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

/**
 * The header's balance, which counts up when it changes.
 *
 * Extracted from the (account) layout so that layout can stay a Server
 * Component: every prop here is serializable.
 *
 * Ported by hand from Animate UI's `primitives-texts-counting-number` rather
 * than installed. Its idea is kept — drive the text from a motion value and
 * write `textContent` directly, so a 600ms count costs zero React renders — but
 * its formatter is `Math.round(latest).toString()`, with no thousands
 * separator at all, which would render a Vietnamese balance of 1.250 as "1250".
 *
 * `locale` is passed in rather than read from the browser. The pill used to be
 * server-rendered with a bare `toLocaleString()`, where Node's ICU default and
 * the browser's never had to agree; a client component re-renders it, and a
 * `.` / `,` disagreement over the group separator is a hydration mismatch.
 */
export function PointsPill({
  value,
  unit,
  locale,
  className,
}: {
  value: number
  unit: string
  locale: string
  className?: string
}) {
  const format = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const digits = useRef<HTMLSpanElement>(null)
  // Seeded with the incoming value, so on first paint from === to and nothing
  // moves. Every route change re-renders this layout; a count-up on each one
  // would be noise.
  const previous = useRef(value)
  const [bump, setBump] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (from === value) return

    // Only a gain is celebrated. A redemption spends points and should not.
    if (value > from) setBump(true)

    const node = digits.current
    if (!node) return
    if (reduced) {
      node.textContent = format.format(value)
      return
    }

    const controls = animate(from, value, {
      duration: COUNT_MS / 1000,
      ease: EASE.outQuart,
      onUpdate: (latest) => {
        node.textContent = format.format(Math.round(latest))
      },
    })
    return () => controls.stop()
  }, [value, format, reduced])

  return (
    <span
      className={cn(
        "bg-surface-high text-label-md text-primary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 whitespace-nowrap",
        // Re-added on every gain and dropped again on animationend, which is
        // what lets a CSS animation replay: it otherwise only restarts when the
        // element is created or its animation-name changes.
        bump && "animate-points-bump",
        className,
      )}
      onAnimationEnd={() => setBump(false)}
    >
      <Sparkles className="size-4" aria-hidden />
      {/* The digits are hidden from assistive tech and announced once, in full,
          by the status line below — a screen reader must hear "1.250 điểm",
          not sixty intermediate numbers. */}
      <span ref={digits} aria-hidden>
        {format.format(value)}
      </span>
      {/* Dropped on the narrowest phones so a six-figure balance cannot push
          the avatar off the row. */}
      <span className="max-sm:hidden" aria-hidden>
        {unit}
      </span>
      <span className="sr-only" role="status">
        {format.format(value)} {unit}
      </span>
    </span>
  )
}
