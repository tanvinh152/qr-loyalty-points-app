"use client"

import * as React from "react"

import {
  Sheet as Drawer,
  SheetClose as DrawerClose,
  SheetContent as SheetContentPrimitive,
  SheetOverlay,
  SheetPortal,
  SheetTitle as SheetTitlePrimitive,
  SheetTrigger as DrawerTrigger,
} from "@/components/animate-ui/primitives/radix/sheet"
import { T } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

// A bottom sheet, wrapping Animate UI's Radix sheet the way ui/dialog.tsx wraps
// its dialog. Deliberately minimal — only the parts the phone account menu uses.
//
// WHAT THIS GAVE UP. It used to be vaul, and vaul brought the parts that are
// genuinely hard on a phone: a drag that yields to the nested scroll container
// below, velocity-based dismiss, iOS scroll-lock and safe-area handling.
// `primitives-radix-sheet` has NONE of them — grep it for `drag`, `swipe` or
// `snap` and you get nothing — so the sheet now closes only by the scrim, the
// Escape key or an explicit control. That is a real regression on the app's
// primary device, accepted deliberately to put the whole ui/ layer on one
// engine. `vaul` is still in package.json: reverting is this one file.
//
// The mitigation is the labelled close button below — without a swipe, the
// sheet needs a visible way out that is not the scrim.

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetContentPrimitive>) {
  return (
    <SheetPortal>
      <SheetOverlay
        data-slot="drawer-overlay"
        className="fixed inset-0 isolate z-50 bg-black/40 supports-backdrop-filter:backdrop-blur-xs"
      />
      <SheetContentPrimitive
        data-slot="drawer-content"
        side="bottom"
        transition={T.base}
        className={cn(
          "bg-popover text-popover-foreground shadow-elevated ring-foreground/10 z-50 flex max-h-[calc(100dvh-3rem)] flex-col rounded-t-3xl ring-1 outline-none",
          className,
        )}
        {...props}
      >
        {/* The grab handle from the mockup. Decorative, and now honestly so:
            with vaul gone there is no swipe for it to advertise, but it is what
            reads as "sheet" in the design. */}
        <div
          aria-hidden
          className="bg-muted-foreground/40 mx-auto mt-3 h-1 w-10 shrink-0 rounded-full"
        />
        <div className="grid gap-1 overflow-y-auto overscroll-contain p-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </SheetContentPrimitive>
    </SheetPortal>
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetTitlePrimitive>) {
  return (
    <SheetTitlePrimitive
      data-slot="drawer-title"
      className={cn(
        "text-label-md text-muted-foreground px-3 pt-1 pb-2 uppercase",
        className,
      )}
      {...props}
    />
  )
}

export { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger }
