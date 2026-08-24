import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { BlogPostRow, BlogPostType } from "@/lib/db-types"

// Reads for the public /blog site. Unlike loyalty.ts these use the
// RLS-scoped client, not the service-role one: nothing here needs to bypass
// row security, since "anon read published posts" (0020) already grants
// exactly the rows a visitor may see.

export async function getPublishedPosts({
  postType,
  limit,
}: {
  postType?: BlogPostType
  /** The dashboard shows three; /blog shows the lot. */
  limit?: number
} = {}): Promise<BlogPostRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from("blog_posts")
    .select("*")
    .eq("is_published", true)
  if (postType) query = query.eq("post_type", postType)
  // `nullsFirst: false` matters: Postgres sorts DESC as NULLS FIRST, so a post
  // published without a date would otherwise head the list — and monopolise the
  // dashboard, which only has room for the first three.
  query = query.order("published_at", { ascending: false, nullsFirst: false })
  if (limit) query = query.limit(limit)
  const { data } = await query
  return (data ?? []) as BlogPostRow[]
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<BlogPostRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle<BlogPostRow>()
  return data ?? null
}
