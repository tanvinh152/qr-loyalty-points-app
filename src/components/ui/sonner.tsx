"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useTheme } from "@/lib/theme/provider"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

// The toaster follows the app's theme rather than being pinned. The surface
// colours below were already theme-correct — the inline custom properties beat
// sonner's own `[data-theme=…]` rules — but everything sonner keeps for itself
// was not: the `richColors` success/error palettes (this is mounted with
// `richColors`), the description ink and the close button all switch on that
// attribute, and pinning it to "light" left them in their light values on a
// dark page.
//
// `useTheme()` resolves the OS preference when there is no cookie, so this is
// the same value <html data-theme> ends up carrying.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
