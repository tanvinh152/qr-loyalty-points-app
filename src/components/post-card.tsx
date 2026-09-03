import Link from "next/link"
import { Newspaper, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import type { BlogPostRow } from "@/lib/db-types"

/**
 * One published post, shared by the /blog list and the dashboard's updates
 * strip. Self-contained the way PortalFooter is — it reads the locale and the
 * messages itself, so neither caller has to build and thread a date formatter.
 *
 * Named `post-card`, NOT `blog-card`: `src/app/admin/blog/blog-card.tsx`
 * already exists and is the admin's editable row, a different thing entirely.
 */
export async function PostCard({
  post,
  layout = "row",
}: {
  post: BlogPostRow
  /** `row` is the full-width list item; `tile` is a cell in a 3-up grid. */
  layout?: "row" | "tile"
}) {
  const [t, locale] = await Promise.all([getMessages(), getLocale()])
  const b = t.blogSite
  const dateFormat = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    { dateStyle: "medium" },
  )
  const tile = layout === "tile"
  const promotion = post.post_type === "promotion"

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        "border-border bg-card duration-quick ease-out-quart grid overflow-hidden rounded-3xl border transition-[colors,transform,box-shadow] hover:-translate-y-0.5 hover:shadow-elevated",
        tile
          ? "hover:border-primary/40 content-start"
          : "gap-4 sm:grid-cols-[200px_1fr]",
      )}
    >
      <div className={cn("relative overflow-hidden", !tile && "sm:h-full")}>
        {post.cover_image_url ? (
          // Admin-entered URLs from any host — a plain <img>, same
          // reasoning as the reward cards.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover_image_url}
            alt=""
            width={400}
            height={225}
            className={cn("h-40 w-full object-cover", !tile && "sm:h-full")}
          />
        ) : (
          <div
            className={cn(
              "bg-surface-container text-muted-foreground grid h-40 place-items-center",
              !tile && "sm:h-full",
            )}
          >
            <Newspaper className="size-8" aria-hidden />
          </div>
        )}
        {/* The mockup floats the category over the cover. Only the tile does
            this: the row card is 200px wide and the chip would cover it. */}
        {tile && (
          <Badge
            className={cn(
              "bg-card/90 absolute top-3 left-3 gap-1 border-transparent backdrop-blur",
              promotion ? "text-warning" : "text-primary",
            )}
          >
            {promotion && <Sparkles className="size-3" aria-hidden />}
            {promotion ? b.promotionChip : b.articleChip}
          </Badge>
        )}
      </div>
      <div
        className={cn(
          "grid gap-2 p-4 sm:p-6",
          tile ? "content-start" : "content-center",
        )}
      >
        {/* The tile already carries this on the cover. */}
        {!tile && promotion && (
          <Badge className="bg-warning/20 text-warning w-fit gap-1">
            <Sparkles className="size-3" aria-hidden />
            {b.promotionChip}
          </Badge>
        )}
        {/* A tile sits under the dashboard section's own heading, so it must
            not open a second h2 at the same level. */}
        {tile ? (
          <h3 className="text-headline-md line-clamp-2">{post.title}</h3>
        ) : (
          <h2 className="text-headline-md">{post.title}</h2>
        )}
        {post.excerpt && (
          <p className="text-body-sm text-muted-foreground line-clamp-2">
            {post.excerpt}
          </p>
        )}
        {post.published_at && (
          <p className="text-label-sm text-muted-foreground uppercase">
            {dateFormat.format(new Date(post.published_at))}
          </p>
        )}
      </div>
    </Link>
  )
}
