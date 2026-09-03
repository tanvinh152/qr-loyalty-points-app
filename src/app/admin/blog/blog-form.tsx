"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { FormDialog } from "@/components/form-dialog"
import { FormError } from "@/components/form-error"
import { ImageUpload } from "@/components/image-upload"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  fieldValue,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n/provider"
import {
  makeBlogPostSchema,
  type BlogPostFormValues,
  type BlogPostInput,
} from "@/lib/schemas"
import type { BlogPostRow } from "@/lib/db-types"
import { saveBlogPost } from "./actions"

/** Create/edit dialog for a blog/promotion post. */
export function BlogPostDialog({
  row,
  trigger,
}: {
  row?: BlogPostRow
  trigger?: React.ReactNode
}) {
  const t = useT()
  const m = t.admin.blog

  const defaultTrigger = row ? (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={`${t.common.edit} — ${row.title}`}
    >
      <Pencil aria-hidden />
    </Button>
  ) : (
    <Button type="button">
      <Plus aria-hidden />
      {m.addTitle}
    </Button>
  )

  return (
    <FormDialog
      title={row ? `${t.common.edit} — ${row.title}` : m.addTitle}
      description={m.helper}
      trigger={trigger ?? defaultTrigger}
      className="sm:max-w-2xl"
    >
      {(close) => <BlogPostFields row={row} onSaved={close} />}
    </FormDialog>
  )
}

// Auto-derived from the title on create only — editing the title afterwards
// must not silently move a post's URL out from under anyone who bookmarked it.
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function BlogPostFields({
  row,
  onSaved,
}: {
  row?: BlogPostRow
  onSaved: () => void
}) {
  const t = useT()
  const m = t.admin.blog
  const [isPending, startTransition] = useTransition()

  const form = useForm<BlogPostFormValues, unknown, BlogPostInput>({
    resolver: zodResolver(makeBlogPostSchema(t.validation)),
    defaultValues: {
      id: row?.id,
      title: row?.title ?? "",
      slug: row?.slug ?? "",
      excerpt: row?.excerpt ?? "",
      content: row?.content ?? "",
      cover_image_url: row?.cover_image_url ?? "",
      post_type: row?.post_type ?? "article",
      is_published: row?.is_published ?? false,
    },
  })

  function onSubmit(values: BlogPostInput) {
    startTransition(async () => {
      const state = await saveBlogPost(values)
      if (!state?.ok) {
        form.setError("root", { message: state?.message ?? m.saveFailed })
        toast.error(state?.message ?? m.saveFailed)
        return
      }
      toast.success(state.message)
      onSaved()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.titleLabel}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={fieldValue(field.value)}
                  onChange={(e) => {
                    field.onChange(e)
                    // Only follow the title while creating: once a post exists
                    // its slug is its URL, and edits must not move it.
                    if (!row) {
                      form.setValue("slug", slugify(e.target.value), {
                        shouldValidate: true,
                      })
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.slug}</FormLabel>
              <FormControl>
                <Input {...field} value={fieldValue(field.value)} />
              </FormControl>
              <FormDescription>{m.slugHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="excerpt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.excerpt}</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} value={fieldValue(field.value)} />
              </FormControl>
              <FormDescription>{m.excerptHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.content}</FormLabel>
              <FormControl>
                <Textarea
                  rows={10}
                  {...field}
                  value={fieldValue(field.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cover_image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.coverImage}</FormLabel>
              <ImageUpload
                value={fieldValue(field.value)}
                onChange={field.onChange}
                folder="blog"
              />
              <FormControl>
                <Input
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  {...field}
                  value={fieldValue(field.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="post_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.postType}</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="article">{m.typeArticle}</SelectItem>
                  <SelectItem value="promotion">{m.typePromotion}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_published"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3">
              <FormControl>
                <Checkbox
                  className="mt-0.5"
                  checked={Boolean(field.value)}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              </FormControl>
              <div className="grid gap-0.5">
                <FormLabel>{m.isPublished}</FormLabel>
                <FormDescription>{m.isPublishedHelper}</FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormError message={form.formState.errors.root?.message} />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t.common.saving : t.common.save}
          </Button>
        </div>
      </form>
    </Form>
  )
}
