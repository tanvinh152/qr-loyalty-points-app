import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * Two letters from a name — first and last initial when there is a surname,
 * otherwise the first two characters. Phone numbers and emails fall through
 * the same path, which is why the source is a plain string.
 */
export function initialsFrom(source: string) {
  const parts = source.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

/**
 * The tinted initials circle in the admin sidebar and the customers table. The
 * designs show a photo; until we store one, `src` stays undefined and the
 * fallback is all that renders.
 */
export function InitialsAvatar({
  name,
  src,
  size = "default",
  className,
}: {
  name: string
  src?: string | null
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  return (
    <Avatar size={size} className={cn("after:border-primary/10", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-accent text-accent-foreground text-body-xs font-bold">
        {initialsFrom(name)}
      </AvatarFallback>
    </Avatar>
  )
}
