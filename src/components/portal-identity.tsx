"use client"

import { ChevronDown } from "lucide-react"

import { InitialsAvatar } from "@/components/initials-avatar"
import { Menu, MenuContent, MenuTrigger } from "@/components/ui/menu"
import { cn } from "@/lib/utils"

// Who is signed in, said once, in the header — shared by both portals for the
// same reason PortalHeader and PortalNav are: one component so /admin and the
// member portal cannot drift apart.
//
// This used to be the rail's bottom `footer` slot in both layouts. It moved up
// because the rail already carries the brand and the destinations, and the one
// place a reader looks for their own account is the top right. The theme switch
// and sign-out came with it, INTO this dropdown: as loose icons beside it they
// were three ungrouped controls fighting for the same corner.
//
// The desktop twin of PortalMenu — a bottom sheet is right under a thumb and
// wrong under a cursor, so the two surfaces stay separate components rather than
// one responsive fudge. Rows arrive as plain children (not PortalMenu's render
// prop): Base UI's Menu closes itself when an item is chosen, so nothing here
// needs a `close` callback.

export function PortalIdentity({
  name,
  caption,
  captionClassName,
  label,
  className,
  children,
}: {
  /** Whatever the portal shows this person as — full name, phone, or email. */
  name: string
  /** The line under the name: tier for a member, role for an admin. */
  caption?: string | null
  /** Colour for `caption`. A literal class string, never interpolated —
   * Tailwind cannot see a computed one. */
  captionClassName?: string
  /** Accessible name for the trigger. */
  label: string
  /** Callers pass `max-md:hidden`: below `md` the account sheet is the avatar. */
  className?: string
  /** The dropdown's rows, as `MenuItem` / `MenuLinkItem`. Server-rendered
   * content (the sign-out server-action form) passes straight through. */
  children: React.ReactNode
}) {
  return (
    <Menu>
      <MenuTrigger
        aria-label={label}
        className={cn(
          "hover:bg-surface-high data-[state=open]:bg-surface-high group flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors",
          className,
        )}
      >
        {/* `size-8`, not the rail's `size="lg"`: the bar is 64px tall and a 40px
            circle beside two lines of text leaves it no breathing room. */}
        <InitialsAvatar name={name} />

        {/* Capped rather than free: a long email or a four-word name would
            otherwise eat the section title beside it. */}
        <div className="min-w-0 max-w-40 text-left lg:max-w-56">
          {/* Never a heading element — PortalHeader's locator <h1> is the only
              one in the bar and portal-header.test.tsx looks it up by role with
              no name. */}
          <p className="text-label-md truncate font-bold">{name}</p>
          {caption && (
            <p
              className={cn(
                "text-label-sm truncate uppercase",
                captionClassName,
              )}
            >
              {caption}
            </p>
          )}
        </div>

        <ChevronDown
          className="text-muted-foreground size-4 shrink-0 duration-quick ease-out-quart transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </MenuTrigger>

      <MenuContent>{children}</MenuContent>
    </Menu>
  )
}
