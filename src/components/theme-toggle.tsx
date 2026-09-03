"use client"

import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import { Moon } from "@/components/animate-ui/icons/moon"
import { Sun } from "@/components/animate-ui/icons/sun"
import { Button } from "@/components/ui/button"
import { MenuItem } from "@/components/ui/menu"
import { useT } from "@/lib/i18n/provider"
import { useTheme } from "@/lib/theme/provider"
import { cn } from "@/lib/utils"

// The light/dark switch. Shows the theme it will switch TO (a sun while dark, a
// moon while light), matching the common toggle convention. `iconOnly` is the
// compact form for the phone header; the default is the full labelled row used
// in the sidebar rails.
export function ThemeToggle({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean
  className?: string
}) {
  const { theme, toggle } = useTheme()
  const t = useT().theme
  const isDark = theme === "dark"
  const label = isDark ? t.switchToLight : t.switchToDark
  const Icon = isDark ? Sun : Moon

  if (iconOnly) {
    return (
      <AnimateIcon animateOnHover asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={label}
          className={className}
        >
          <Icon className="size-5" aria-hidden />
        </Button>
      </AnimateIcon>
    )
  }

  return (
    <AnimateIcon animateOnHover asChild>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggle}
        aria-label={label}
        className={cn("w-full justify-start", className)}
      >
        <Icon className="size-4" aria-hidden />
        {isDark ? t.light : t.dark}
      </Button>
    </AnimateIcon>
  )
}

/**
 * The same switch as a row inside the desktop account dropdown. Its own
 * component rather than `<MenuItem asChild><ThemeToggle /></MenuItem>` because
 * Radix's `asChild` spreads the item's props onto the child exactly as Base UI's
 * `render` did, and ThemeToggle's Button would swallow them. The gotcha survived
 * the migration — do not "simplify" it back.
 *
 * `closeOnClick={false}`: flipping the theme is not leaving the menu, and
 * watching the popup vanish under the cursor reads as a misfire.
 */
export function ThemeMenuItem() {
  const { theme, toggle } = useTheme()
  const t = useT().theme
  const isDark = theme === "dark"
  const Icon = isDark ? Sun : Moon

  return (
    <AnimateIcon animateOnHover asChild>
      <MenuItem closeOnClick={false} onClick={toggle}>
        <Icon className="size-5" aria-hidden />
        {isDark ? t.light : t.dark}
      </MenuItem>
    </AnimateIcon>
  )
}
