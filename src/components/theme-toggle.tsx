"use client"

import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
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
    )
  }

  return (
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
  )
}
