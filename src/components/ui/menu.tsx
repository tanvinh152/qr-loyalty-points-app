"use client"

import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"

// A dropdown, wrapping Base UI's Menu the way ui/drawer.tsx wraps Drawer.
// Deliberately minimal — only the parts the desktop account dropdown uses. Base
// UI ships more (Group, GroupLabel, CheckboxItem, RadioItem, SubmenuRoot, Arrow);
// add a part when something needs it rather than maintaining surface nothing
// calls.
//
// The phone's twin is ui/drawer.tsx: a bottom sheet is right under the thumb and
// wrong under a cursor, so the two surfaces stay separate components rather than
// one responsive fudge.

function Menu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />
}

function MenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />
}

function MenuContent({
  className,
  sideOffset = 8,
  align = "end",
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "sideOffset" | "align">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="z-50 outline-none"
        sideOffset={sideOffset}
        align={align}
      >
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            "bg-popover text-popover-foreground shadow-elevated ring-foreground/10 grid min-w-56 gap-1 rounded-2xl p-2 ring-1 outline-none",
            "origin-[var(--transform-origin)] transition-[opacity,scale] duration-150",
            "data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

/** The row shape every entry wears — the dropdown's twin of `MENU_ROW`. */
const MENU_ITEM =
  "text-body-sm data-highlighted:bg-surface-high flex w-full cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors outline-none"

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(MENU_ITEM, className)}
      {...props}
    />
  )
}

function MenuLinkItem({ className, ...props }: MenuPrimitive.LinkItem.Props) {
  return (
    <MenuPrimitive.LinkItem
      data-slot="menu-link-item"
      className={cn(MENU_ITEM, className)}
      {...props}
    />
  )
}

function MenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
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
