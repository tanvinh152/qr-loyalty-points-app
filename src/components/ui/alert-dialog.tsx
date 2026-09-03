"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogCancel as AlertDialogCancelPrimitive,
  AlertDialogContent as AlertDialogContentPrimitive,
  AlertDialogDescription as AlertDialogDescriptionPrimitive,
  AlertDialogOverlay as AlertDialogOverlayPrimitive,
  AlertDialogPortal,
  AlertDialogTitle as AlertDialogTitlePrimitive,
  AlertDialogTrigger,
} from "@/components/animate-ui/primitives/radix/alert-dialog"
import { Button } from "@/components/ui/button"
import { T } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

// Same arrangement as ui/dialog.tsx: presence is <AnimatePresence> inside
// Animate UI's AlertDialogPortal, so the `data-open:` / `data-closed:` animate
// utilities and the `duration-quick ease-out-quart` that timed them are gone.
// Everything the design owns — the `size` grid, the media slot, the footer's
// bleed — is rebuilt here on top, unchanged.

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogOverlayPrimitive>) {
  return (
    <AlertDialogOverlayPrimitive
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: T.exit }}
      transition={T.base}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogContentPrimitive> & {
  size?: "default" | "sm"
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogContentPrimitive
        data-size={size}
        className={cn(
          "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-6 rounded-3xl bg-popover p-6 text-popover-foreground shadow-elevated ring-1 ring-foreground/10 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm",
          className,
        )}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: T.exit }}
        transition={T.base}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "-mx-6 -mb-6 mt-2 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-surface-container p-6 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-10 items-center justify-center rounded-2xl bg-surface-container sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogTitlePrimitive>) {
  return (
    <AlertDialogTitlePrimitive
      className={cn(
        "font-heading text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogDescriptionPrimitive>) {
  return (
    <AlertDialogDescriptionPrimitive
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

// Deliberately NOT wrapped in Radix's `Action`: this project's confirmations
// run a server action and decide for themselves when to close, and Action
// closes the dialog on click no matter what the handler is still doing.
function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="alert-dialog-action"
      className={cn(className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogCancelPrimitive> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    // `children` is pulled out and rendered INSIDE the Button rather than left
    // in `props`: the Button is Cancel's slotted child, so anything Radix
    // spread as `children` would be overwritten by it and the button would come
    // out empty — no label, no accessible name.
    <AlertDialogCancelPrimitive asChild {...props}>
      <Button
        data-slot="alert-dialog-cancel"
        variant={variant}
        size={size}
        className={cn(className)}
      >
        {children}
      </Button>
    </AlertDialogCancelPrimitive>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
