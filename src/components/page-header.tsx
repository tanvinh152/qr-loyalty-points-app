import { cn } from "@/lib/utils"

// Title + one-line subtitle, with an optional utility slot (search, stat pill)
// pulled to the right once there's room. Every admin page opens with this.
export function PageHeader({
  title,
  description,
  eyebrow,
  size = "default",
  className,
  children,
}: {
  /** A node rather than a string so a page can colour part of the headline —
   * the roadmap splits its title across two tones, as the mockup does. */
  title: React.ReactNode
  /** A node rather than a string so a page can hang a link off the subtitle. */
  description?: React.ReactNode
  /** Status chip that sits above the title on the customer screens. */
  eyebrow?: React.ReactNode
  /** `display` is the 48px hero treatment the Stitch customer screens use. */
  size?: "default" | "display"
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="grid gap-1">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1
          className={
            size === "display"
              ? // 36px (the display's own phone step-down) still runs a
                // Vietnamese greeting to three lines on a 328px column.
                "text-headline-lg sm:text-display"
              : "text-headline-lg"
          }
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              "text-muted-foreground",
              size === "display" ? "text-body-lg max-w-2xl" : "text-body-sm",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="w-full md:w-auto md:shrink-0">{children}</div>
      )}
    </div>
  )
}
