import Link from "next/link"
import { Newspaper } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { PostCard } from "@/components/post-card"
import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/server"
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

  const posts = await getPublishedPosts({ postType })

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
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
