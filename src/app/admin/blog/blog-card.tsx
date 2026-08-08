import { Newspaper, Sparkles } from "lucide-react"

import { ConfirmDelete } from "@/components/confirm-delete"
import { TruncatedText } from "@/components/truncated-text"
import { Badge } from "@/components/ui/badge"
import { getMessages } from "@/lib/i18n/server"
import type { BlogPostRow } from "@/lib/db-types"
import { BlogPostDialog } from "./blog-form"
import { deleteBlogPost } from "./actions"

/**
 * One tile in the post grid: cover image, type/status chips, title, excerpt.
 * Same shape as the reward admin card so the two lists read as one system.
 */
export async function BlogPostCard({ post }: { post: BlogPostRow }) {
  const t = await getMessages()
  const m = t.admin.blog

  return (
    <article className="border-border bg-card grid overflow-hidden rounded-xl border">
      <div className="bg-surface-container relative aspect-[4/3] w-full">
        {post.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover_image_url}
            alt=""
            width={480}
            height={360}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground grid size-full place-items-center">
            <Newspaper className="size-8" aria-hidden />
          </span>
        )}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
          {post.post_type === "promotion" && (
            <Badge className="bg-warning/20 text-warning gap-1">
              <Sparkles className="size-3" aria-hidden />
              {m.typePromotion}
            </Badge>
          )}
          <Badge variant={post.is_published ? "secondary" : "muted"}>
            {post.is_published ? m.publishedChip : m.draftChip}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 p-6">
        <div className="grid gap-1">
          <TruncatedText className="text-headline-md">
            {post.title}
          </TruncatedText>
          {post.excerpt && (
            <TruncatedText className="text-body-sm text-muted-foreground">
              {post.excerpt}
            </TruncatedText>
          )}
          <p className="text-muted-foreground text-label-sm">/blog/{post.slug}</p>
        </div>

        <div className="flex items-center justify-end gap-1">
          <BlogPostDialog row={post} />
          <ConfirmDelete
            name={post.title}
            onConfirm={deleteBlogPost.bind(null, post.id)}
          />
        </div>
      </div>
    </article>
  )
}
