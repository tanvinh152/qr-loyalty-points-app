"use client"

import { useState } from "react"

import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { InitialsAvatar } from "@/components/initials-avatar"
import { cn } from "@/lib/utils"

// The phone sheet behind the avatar, shared by both portals. From `md` up each
// header has room for its controls as controls, and the rail carries who you
// are; below `md` there is no such room — the arithmetic at 390px does not fit
// — so the overflow lives here.
//
// Rows come in through a render prop rather than as plain children because
// every one of them has to call `close`: a Link inside the sheet changes the
// route WITHOUT unmounting the layout, so nothing else would take the sheet
// down off the page the user just asked for.

/** The row shape every entry in the sheet wears. */
export const MENU_ROW =
  "text-body-sm hover:bg-surface-high flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors"

export function PortalMenu({
  name,
  avatarLabel,
  title,
  className,
  children,
}: {
  /** Whatever the portal shows this person as — full name, phone, or email. */
  name: string
  /** Accessible name for the avatar trigger. */
  avatarLabel: string
  /** Heading above the rows. */
  title: string
  className?: string
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        aria-label={avatarLabel}
        className={cn("shrink-0 rounded-full", className)}
      >
        <InitialsAvatar name={name} />
      </DrawerTrigger>

      <DrawerContent>
        <DrawerTitle>{title}</DrawerTitle>
        {children(close)}
      </DrawerContent>
    </Drawer>
  )
}
