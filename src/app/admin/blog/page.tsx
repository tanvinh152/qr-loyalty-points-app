import { CheckCircle2, Newspaper } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { StatCard } from "@/components/stat-card"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import type { BlogPostRow } from "@/lib/db-types"
import { BlogPostCard } from "./blog-card"
import { BlogPostDialog } from "./blog-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.blog.metaTitle }
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const t = await getMessages()
  const m = t.admin.blog
  const { q } = await searchParams
  const search = q?.trim()

  const supabase = await createClient()
  let query = supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false })
  if (search) query = query.ilike("title", `%${search}%`)

  const { data } = await query
  const posts = (data ?? []) as BlogPostRow[]
  const published = posts.filter((p) => p.is_published).length

  return (
    <div className="grid gap-6">
      <PageHeader title={m.title} description={m.helper}>
        <BlogPostDialog />
      </PageHeader>

      <div className="grid gap-6 sm:grid-cols-2">
        <StatCard label={m.statTotal} value={posts.length} icon={Newspaper} />
        <StatCard
          label={m.statPublished}
          value={published}
          icon={CheckCircle2}
          tone="secondary"
        />
      </div>

      <SearchInput
        action="/admin/blog"
        defaultValue={search}
        label={t.common.search}
        placeholder={m.searchPlaceholder}
        className="sm:w-96"
      />

      {posts.length === 0 ? (
        <EmptyState title={search ? m.noMatch : m.empty} icon={Newspaper} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
