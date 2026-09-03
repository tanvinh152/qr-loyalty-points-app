"use client"

import * as React from "react"

import {
  DropdownMenu as Menu,
  DropdownMenuContent as MenuContentPrimitive,
  DropdownMenuItem as MenuItemPrimitive,
  DropdownMenuSeparator as MenuSeparatorPrimitive,
  DropdownMenuTrigger as MenuTrigger,
} from "@/components/animate-ui/primitives/radix/dropdown-menu"
import { T } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

// A dropdown, wrapping Animate UI's Radix dropdown the way ui/drawer.tsx wraps
// the bottom sheet. Deliberately minimal — only the parts the desktop account
// dropdown uses. The primitive ships more (Group, Label, CheckboxItem,
// RadioItem, Sub*, ItemIndicator); add a part when something needs it rather
// than maintaining surface nothing calls.
//
// The phone's twin is ui/drawer.tsx: a bottom sheet is right under the thumb and
// wrong under a cursor, so the two surfaces stay separate components rather than
// one responsive fudge.
//
// Presence is <AnimatePresence> inside the primitive's Content, so the
// `data-open:animate-*` utilities this file used to carry are gone. Radix still
// stamps `data-state` on the TRIGGER, which is what keeps
// `group-data-[state=open]:rotate-180` working in portal-identity.tsx, and it
// still stamps `data-highlighted` on rows, which is what keeps MENU_ITEM's hover
// background working. Only the presence variants died.

function MenuContent({
  className,
  sideOffset = 8,
  align = "end",
  ...props
}: React.ComponentProps<typeof MenuContentPrimitive>) {
  return (
    <MenuContentPrimitive
      sideOffset={sideOffset}
      align={align}
      transition={T.quick}
      className={cn(
        "bg-popover text-popover-foreground shadow-elevated ring-foreground/10 z-50 grid min-w-56 gap-1 rounded-2xl p-2 ring-1 outline-none",
        "origin-(--radix-dropdown-menu-content-transform-origin)",
        className,
      )}
      {...props}
    />
  )
}

/** The row shape every entry wears — the dropdown's twin of `MENU_ROW`. */
const MENU_ITEM =
  "text-body-sm data-highlighted:bg-surface-high flex w-full cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors outline-none"

/**
 * `closeOnClick={false}` is OUR prop, kept from the Base UI era so call sites
 * and the reasoning recorded in AGENTS.md did not have to change. It maps to
 * Radix's `onSelect` + preventDefault. Do not reach for `onSelect` at a call
 * site — a caller that passes both would silently lose one.
 */
function MenuItem({
  className,
  closeOnClick = true,
  onSelect,
  ...props
}: React.ComponentProps<typeof MenuItemPrimitive> & {
  closeOnClick?: boolean
}) {
  return (
    <MenuItemPrimitive
      className={cn(MENU_ITEM, className)}
      onSelect={(event) => {
        if (!closeOnClick) event.preventDefault()
        onSelect?.(event)
      }}
      {...props}
    />
  )
}

/**
 * There is no LinkItem part. `asChild` puts role="menuitem" and the keyboard
 * wiring onto the caller's own `<Link>`, which is what Base UI's LinkItem did
 * internally. The children go INSIDE that Link, not beside it.
 *
 * `asChild` on the item is this repo's own addition to the vendored primitive —
 * upstream omits it and hard-renders a div. See the note in
 * animate-ui/primitives/radix/dropdown-menu.tsx.
 */
function MenuLinkItem({
  className,
  ...props
}: React.ComponentProps<typeof MenuItemPrimitive>) {
  return (
    <MenuItemPrimitive
      asChild
      className={cn(MENU_ITEM, className)}
      {...props}
    />
  )
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuSeparatorPrimitive>) {
  return (
    <MenuSeparatorPrimitive
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

export {
  MENU_ITEM,
  Menu,
  MenuContent,
  MenuItem,
  MenuLinkItem,
  MenuSeparator,
  MenuTrigger,
}
