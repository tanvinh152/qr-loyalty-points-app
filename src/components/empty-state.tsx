import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Centered placeholder for an empty table or list. */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid justify-items-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="bg-surface-container text-muted-foreground mb-1 grid size-10 place-items-center rounded-full">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="text-body-lg font-semibold">{title}</p>
      {description && (
        <p className="text-body-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
