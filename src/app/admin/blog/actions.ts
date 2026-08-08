"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { makeBlogPostSchema, type BlogPostInput } from "@/lib/schemas"
import { deleteImageByUrl } from "@/lib/storage"

export type SaveState = { ok: boolean; message: string } | null

/** The client validates first, but the server is the authority. */
export async function saveBlogPost(input: BlogPostInput): Promise<SaveState> {
  const t = await getMessages()
  const m = t.admin.blog

  const parsed = makeBlogPostSchema(t.validation).safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? m.saveFailed,
    }
  }

  const {
    id: rowId,
    excerpt,
    cover_image_url,
    is_published,
    ...rest
  } = parsed.data

  const supabase = await createClient()

  // Same read-before-write as saveReward: know what image to retire, and
  // whether this post has ever been published before, before writing.
  let replaced: string | null = null
  let publishedAt: string | null = null
  if (rowId) {
    const { data: current } = await supabase
      .from("blog_posts")
      .select("cover_image_url, published_at")
      .eq("id", rowId)
      .maybeSingle()
    if (current?.cover_image_url && current.cover_image_url !== cover_image_url) {
      replaced = current.cover_image_url
    }
    publishedAt = current?.published_at ?? null
  }

  const payload = {
    ...rest,
    excerpt: excerpt || null,
    cover_image_url: cover_image_url || null,
    is_published,
    // Set once, on first publish; unpublishing keeps the original date rather
    // than erasing when the post was first live.
    published_at: is_published ? (publishedAt ?? new Date().toISOString()) : publishedAt,
  }

  const { error } = rowId
    ? await supabase.from("blog_posts").update(payload).eq("id", rowId)
    : await supabase.from("blog_posts").insert(payload)

  if (error) {
    if (error.code === "23505") return { ok: false, message: m.slugConflict }
    return { ok: false, message: m.saveFailed }
  }

  await deleteImageByUrl(replaced)

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
  return { ok: true, message: m.saved }
}

/** Resolves to an error message, or to nothing when the row is gone. */
export async function deleteBlogPost(id: string): Promise<string | void> {
  const t = await getMessages()
  if (!id) return t.admin.blog.deleteFailed

  const supabase = await createClient()
  const { data: current } = await supabase
    .from("blog_posts")
    .select("cover_image_url")
    .eq("id", id)
    .maybeSingle()

  const { error } = await supabase.from("blog_posts").delete().eq("id", id)
  if (error) return t.admin.blog.deleteFailed

  await deleteImageByUrl(current?.cover_image_url)

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
}
