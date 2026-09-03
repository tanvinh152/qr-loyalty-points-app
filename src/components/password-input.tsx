"use client"

import { useState } from "react"
import { Eye, EyeOff, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * A password field with the show/hide toggle both auth forms need. The toggle
 * is a real `Button` (`icon-sm`, 32px, widened to 44px on touch by the button's
 * own `pointer-coarse` hit area) — it was an 18px bare `<button>` that a thumb
 * could not find.
 *
 * The Button is NOT positioned with `-translate-y-1/2`: Motion writes
 * `transform` inline for the press, which would beat the class and jump the
 * icon. It sits in a flex wrapper that spans the field's height instead.
 * `Eye`/`EyeOff` stay static lucide glyphs — the registry has neither.
 */
export function PasswordInput({
  showLabel,
  hideLabel,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "icon"> & {
  showLabel: string
  hideLabel: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={shown ? "text" : "password"}
        icon={Lock}
        className={className ? `pr-12 ${className}` : "pr-12"}
      />
      <div className="absolute inset-y-0 right-1 flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? hideLabel : showLabel}
          aria-pressed={shown}
          className="rounded-full"
        >
          {shown ? (
            <EyeOff className="size-[18px]" aria-hidden />
          ) : (
            <Eye className="size-[18px]" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  )
}
