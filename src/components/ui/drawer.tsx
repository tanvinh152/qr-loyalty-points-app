"use client"

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@/lib/utils"

// A bottom sheet, wrapping Base UI's Drawer the way ui/dialog.tsx wraps Dialog.
// Deliberately minimal — only the parts the phone account menu uses. Base UI
// ships more (Viewport, SwipeArea, Indent, snap points); add a part when
// something needs it rather than maintaining surface nothing calls.
//
// `swipeDirection` defaults to "down", which is exactly a swipe-to-dismiss
// bottom sheet, so it is not passed. The popup translates itself through
// `--drawer-swipe-movement-y` while dragging; the `translate-y-full` closed
// state below is only the open/close transition.

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerContent({
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Backdrop
        data-slot="drawer-overlay"
        className="fixed inset-0 isolate z-50 bg-black/40 duration-200 supports-backdrop-filter:backdrop-blur-xs data-closed:opacity-0 data-starting-style:opacity-0"
      />
      <DrawerPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "bg-popover text-popover-foreground shadow-elevated ring-foreground/10 fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-3rem)] flex-col rounded-t-3xl ring-1 outline-none",
          "transition-transform duration-200 data-closed:translate-y-full data-starting-style:translate-y-full",
          // No transition while the finger is down, or the sheet lags the drag.
          "data-swiping:transition-none",
          className,
        )}
        {...props}
      >
        {/* The grab handle from the mockup. Decorative — the whole sheet is the
            swipe target, so it carries no role of its own. */}
        <div
          aria-hidden
          className="bg-muted-foreground/40 mx-auto mt-3 h-1 w-10 shrink-0 rounded-full"
        />
        <div className="grid gap-1 overflow-y-auto overscroll-contain p-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerPrimitive.Popup>
    </DrawerPrimitive.Portal>
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
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
