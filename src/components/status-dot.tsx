import { cn } from "@/lib/utils"

/** Colored dot + label, the row status marker in the admin tables. */
export function StatusDot({
  label,
  tone = "neutral",
  className,
}: {
  label: string
  tone?: "success" | "neutral" | "destructive"
  className?: string
}) {
  return (
    <span
      className={cn(
        "text-label-md flex items-center gap-1.5",
        tone === "success" && "text-success",
        tone === "neutral" && "text-muted-foreground",
        tone === "destructive" && "text-destructive",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  )
}
