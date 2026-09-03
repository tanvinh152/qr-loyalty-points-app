"use client"

import * as React from "react"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import { X as XIcon } from "@/components/animate-ui/icons/x"

import {
  Dialog,
  DialogClose,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogOverlay as DialogOverlayPrimitive,
  DialogPortal,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger,
} from "@/components/animate-ui/primitives/radix/dialog"
import { Button } from "@/components/ui/button"
import { T } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

// Presence is Motion's now: Animate UI's DialogPortal holds the tree inside
// <AnimatePresence>, so the `data-open:animate-*` / `data-closed:animate-*`
// utilities this file used to carry are gone, along with the `duration-quick
// ease-out-quart` that timed them. Both numbers moved to the `transition` props
// below. Putting the CSS back would animate every open twice.
//
// Tailwind v4 emits `-translate-x-1/2` as the standalone `translate` property,
// not as `transform`, so Motion's `scale` composes with the centring instead of
// overwriting it. Verified against the compiled stylesheet — do not "fix" the
// centring by moving it into a Motion `x`/`y`.

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogOverlayPrimitive>) {
  return (
    <DialogOverlayPrimitive
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      // Opacity only. Animate UI's default also animates `filter: blur(4px)`,
      // which on a full-viewport element is a repaint of the entire page every
      // frame — and the scrim already blurs statically via backdrop-filter.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: T.exit }}
      transition={T.base}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogContentPrimitive> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogContentPrimitive
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-popover text-body-sm text-popover-foreground shadow-elevated ring-1 ring-foreground/10 outline-none sm:max-w-lg",
          className,
        )}
        // Replaces Animate UI's `perspective(500px) rotateX(-20deg) scale(0.8)`
        // flip: a 20° 3-D rotation is not in this design language, and the
        // `zoom-in-95` it replaces is. `blur()` is dropped for the same reason
        // as on the overlay.
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: T.exit }}
        transition={T.base}
        {...props}
      >
        {/* The padding lives on the scroll box, not the popup: a form taller
            than the viewport has to scroll inside the dialog rather than push
            its submit button off-screen, and DialogFooter's `-mx-6 -mb-6`
            bleed still needs a p-6 parent to cancel out. */}
        <div
          data-slot="dialog-body"
          className="grid gap-6 overflow-y-auto overscroll-contain p-6"
        >
          {children}
        </div>
        {showCloseButton && (
          <AnimateIcon animateOnHover asChild>
            <DialogClose asChild>
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </AnimateIcon>
        )}
      </DialogContentPrimitive>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-6 -mb-6 mt-2 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-surface-container p-6 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitlePrimitive>) {
  return (
    <DialogTitlePrimitive
      className={cn(
        "font-heading text-base leading-none font-medium",
        className,
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescriptionPrimitive>) {
  return (
    <DialogDescriptionPrimitive
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
