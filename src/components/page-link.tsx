import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Pagination link that renders as a disabled-looking span when there's no target.
export function PageLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled?: boolean
  children: React.ReactNode
}) {
  const className = cn(buttonVariants({ variant: "outline", size: "sm" }))
  if (disabled) {
    return (
      <span className={cn(className, "pointer-events-none opacity-50")}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
