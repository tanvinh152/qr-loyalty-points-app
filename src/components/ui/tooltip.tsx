"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import {
  Tooltip,
  TooltipArrow,
  TooltipContent as TooltipContentPrimitive,
  TooltipPortal,
  TooltipProvider as TooltipProviderPrimitive,
  TooltipTrigger,
} from "@/components/animate-ui/primitives/radix/tooltip"
import { T } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

// Built on Animate UI's PRIMITIVE layer, never its `components-radix-tooltip`:
// that one exports no provider and nests a fresh `TooltipProvider` inside every
// tooltip, which would silently strip the app-wide `delay={0}` set in
// src/app/layout.tsx and put a 700ms wait in front of every reveal.
//
// Presence is now Motion's, not CSS's: TooltipPortal wraps the popup in
// <AnimatePresence>, so the enter/exit `data-[state=…]:animate-*` utilities this
// file used to carry are gone. Do not add them back — they would run alongside
// the JS animation and the popup would fade in twice.

// The prop is called `delay`, not Radix's `delayDuration`. That name is part of
// this wrapper's public surface — src/app/layout.tsx and truncated-text.test.tsx
// both pass it — so it is mapped here rather than renamed at 4 call sites.
function TooltipProvider({
  delay = 0,
  ...props
}: Omit<
  React.ComponentProps<typeof TooltipPrimitive.Provider>,
  "delayDuration"
> & { delay?: number }) {
  return <TooltipProviderPrimitive delayDuration={delay} {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipContentPrimitive>) {
  return (
    <TooltipPortal>
      <TooltipContentPrimitive
        // Animate UI stamps `data-slot="popover-content"` on its own motion div
        // — a copy-paste slip in the registry. It spreads incoming props last,
        // so this wins. truncated-text.test.tsx queries this exact string.
        data-slot="tooltip-content"
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        // Animate UI's default pops from scale 0.5. The house entrance is
        // `zoom-in-95`, so this matches what the CSS did, on the token that
        // names "chips, small transforms, popups".
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: T.exit }}
        transition={T.quick}
        className={cn(
          "bg-foreground text-background z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm",
          className,
        )}
        {...props}
      >
        {children}
        {/* Radix's Arrow is a real <svg> that it rotates per side, so it takes a
            `fill` and a size — not Base UI's rotate-45 square, whose whole
            positioning depended on a data-side attribute this element does not
            carry. */}
        <TooltipArrow width={10} height={5} className="fill-foreground" />
      </TooltipContentPrimitive>
    </TooltipPortal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
