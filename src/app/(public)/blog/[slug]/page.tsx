import Link from "next/link"
import { ArrowLeft, Newspaper, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getPublishedPostBySlug } from "@/lib/blog"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPublishedPostBySlug(slug)
  const t = await getMessages()
  return { title: post ? post.title : t.blogSite.notFoundTitle }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const t = await getMessages()
  const b = t.blogSite

  const [post, locale] = await Promise.all([
    getPublishedPostBySlug(slug),
    getLocale(),
  ])

  const backLink = (
    <Link
      href="/blog"
      className={cn(buttonVariants({ variant: "muted" }))}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {b.backToBlog}
    </Link>
  )

  if (!post) {
    return (
      <div className="grid gap-6">
        <div className="border-border bg-card rounded-3xl border">
          <EmptyState
            icon={Newspaper}
            title={b.notFoundTitle}
            description={b.notFoundBody}
          />
        </div>
        {backLink}
      </div>
    )
  }

  const dateFormat = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "long",
  })

  return (
    <article className="grid gap-6">
      {backLink}

      <div className="grid gap-3">
        {post.post_type === "promotion" && (
          <Badge className="bg-warning/20 text-warning w-fit gap-1">
            <Sparkles className="size-3" aria-hidden />
            {b.promotionChip}
          </Badge>
        )}
        <h1 className="text-headline-lg sm:text-display">{post.title}</h1>
        {post.published_at && (
          <p className="text-body-sm text-muted-foreground">
            {dateFormat.format(new Date(post.published_at))}
          </p>
        )}
      </div>

      {post.cover_image_url && (
        // Admin-entered URL from any host — a plain <img>, same reasoning as
        // every other admin-sourced image in this app.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover_image_url}
          alt=""
          width={960}
          height={540}
          className="max-h-96 w-full rounded-3xl object-cover"
        />
      )}

      {/* Plain text, one paragraph per blank line — admin content has no rich
          editor yet, so this is what `content` actually holds. */}
      <div className="text-body-lg grid gap-4 whitespace-pre-wrap">
        {post.content}
      </div>
    </article>
  )
}
