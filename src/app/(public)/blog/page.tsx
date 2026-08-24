import Link from "next/link"
import { Newspaper, Sparkles } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getPublishedPosts } from "@/lib/blog"
import type { BlogPostType } from "@/lib/db-types"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.blogSite.metaTitle }
}

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const t = await getMessages()
  const b = t.blogSite
  const { type } = await searchParams
  const postType: BlogPostType | undefined =
    type === "article" || type === "promotion" ? type : undefined

  const [posts, locale] = await Promise.all([
    getPublishedPosts({ postType }),
    getLocale(),
  ])
  const dateFormat = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "medium",
  })

  const tabs = [
    { key: undefined, label: b.tabAll },
    { key: "article" as const, label: b.tabArticles },
    { key: "promotion" as const, label: b.tabPromotions },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader title={b.title} />

      <nav aria-label={b.title} className="flex gap-2">
        {tabs.map((tab) => {
          const active = postType === tab.key
          return (
            <Link
              key={tab.key ?? "all"}
              href={tab.key ? `/blog?type=${tab.key}` : "/blog"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-label-md shrink-0 rounded-full px-4 py-2 transition-colors",
                active
                  ? "bg-primary-container text-primary-foreground font-semibold"
                  : "bg-surface-container text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {posts.length === 0 ? (
        <div className="border-border bg-card rounded-3xl border">
          <EmptyState
            icon={Newspaper}
            title={b.emptyTitle}
            description={b.emptyBody}
          />
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="border-border bg-card grid gap-4 overflow-hidden rounded-3xl border transition-colors sm:grid-cols-[200px_1fr]"
            >
              {post.cover_image_url ? (
                // Admin-entered URLs from any host — a plain <img>, same
                // reasoning as the reward cards.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.cover_image_url}
                  alt=""
                  width={400}
                  height={225}
                  className="h-40 w-full object-cover sm:h-full"
                />
              ) : (
                <div className="bg-surface-container text-muted-foreground grid h-40 place-items-center sm:h-full">
                  <Newspaper className="size-8" aria-hidden />
                </div>
              )}
              <div className="grid content-center gap-2 p-4 sm:p-6">
                {post.post_type === "promotion" && (
                  <Badge className="bg-warning/20 text-warning w-fit gap-1">
                    <Sparkles className="size-3" aria-hidden />
                    {b.promotionChip}
                  </Badge>
                )}
                <h2 className="text-headline-md">{post.title}</h2>
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
          ))}
        </div>
      )}
    </div>
  )
}
