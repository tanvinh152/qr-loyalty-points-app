import { expect, test } from "@playwright/test"

import { db } from "./fixtures/db"
import { fillStable } from "./fixtures/hydration"

/**
 * `/admin/blog` — the only content that reaches the PUBLIC site.
 *
 * `/blog` and `/blog/[slug]` are deliberately outside the auth guard (the
 * register screen links to `/terms` beside them), so what is published here is
 * readable signed out. That round trip is the point of the last case.
 */

const SLUG = "e2e-bai-viet"

async function purge() {
  const { error } = await db().from("blog_posts").delete().like("slug", "e2e-%")
  if (error) throw new Error(`purge: ${error.message}`)
}

test.beforeEach(purge)
test.afterAll(purge)

const save = async (dialog: import("@playwright/test").Locator) => {
  await dialog.getByRole("button", { name: /^lưu$/i }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

async function compose(
  page: import("@playwright/test").Page,
  { title, slug }: { title: string; slug: string },
) {
  await page.getByRole("button", { name: /bài viết mới/i }).click()
  const dialog = page.getByRole("dialog")
  await fillStable(dialog.locator('[name="title"]'), title)
  await fillStable(dialog.locator('[name="slug"]'), slug)
  await fillStable(
    dialog.locator('[name="content"]'),
    "Nội dung thử nghiệm E2E.",
  )
  return dialog
}

test("a draft is saved unpublished and stays off the public site", async ({
  page,
}) => {
  await page.goto("/admin/blog")
  const dialog = await compose(page, { title: "E2E Bài nháp", slug: SLUG })
  await save(dialog)

  const { data } = await db()
    .from("blog_posts")
    .select("title, is_published, published_at, post_type")
    .eq("slug", SLUG)
    .single()
  expect(data).toMatchObject({ is_published: false, post_type: "article" })
  expect(data!.published_at).toBeNull()
})

test("publishing stamps a date, and unpublishing keeps it", async ({
  page,
}) => {
  await page.goto("/admin/blog")
  let dialog = await compose(page, { title: "E2E Bài đăng", slug: SLUG })
  await dialog.getByRole("checkbox", { name: /đã xuất bản/i }).click()
  await save(dialog)

  const { data: published } = await db()
    .from("blog_posts")
    .select("is_published, published_at")
    .eq("slug", SLUG)
    .single()
  expect(published!.is_published).toBe(true)
  expect(published!.published_at).not.toBeNull()

  // Unpublishing hides the post but must not forget when it first went out —
  // re-publishing later should not look like a brand new article.
  await page.getByRole("button", { name: /^Sửa — E2E Bài đăng$/ }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByRole("checkbox", { name: /đã xuất bản/i }).click()
  await save(dialog)

  const { data: hidden } = await db()
    .from("blog_posts")
    .select("is_published, published_at")
    .eq("slug", SLUG)
    .single()
  expect(hidden!.is_published).toBe(false)
  expect(hidden!.published_at).toBe(published!.published_at)
})

test("two posts cannot share a slug", async ({ page }) => {
  const { error } = await db().from("blog_posts").insert({
    title: "E2E Gốc",
    slug: SLUG,
    content: "x",
    post_type: "article",
    is_published: false,
  })
  if (error) throw new Error(error.message)

  await page.goto("/admin/blog")
  const dialog = await compose(page, { title: "E2E Trùng", slug: SLUG })
  await dialog.getByRole("button", { name: /^lưu$/i }).click()

  // The slug IS the public URL, so a clash has to be refused rather than
  // silently handed to whichever row was written last.
  await expect(dialog.getByText(/đã được/i).first()).toBeVisible()
})

test("a published post is readable by a signed-out visitor", async ({
  page,
  context,
}) => {
  await page.goto("/admin/blog")
  const dialog = await compose(page, { title: "E2E Công khai", slug: SLUG })
  await dialog.getByRole("checkbox", { name: /đã xuất bản/i }).click()
  await save(dialog)

  // A brand new context, with no admin cookies at all.
  const guest = await context.browser()!.newContext()
  const guestPage = await guest.newPage()
  await guestPage.goto(`${page.url().split("/admin")[0]}/blog/${SLUG}`)
  await expect(guestPage.getByText("Nội dung thử nghiệm E2E.")).toBeVisible()
  await guest.close()
})

test("deleting a post asks first and then removes it", async ({ page }) => {
  const { error } = await db().from("blog_posts").insert({
    title: "E2E Sắp xóa",
    slug: SLUG,
    content: "x",
    post_type: "article",
    is_published: false,
  })
  if (error) throw new Error(error.message)

  await page.goto("/admin/blog")
  await page.getByRole("button", { name: /^Xóa — E2E Sắp xóa$/ }).click()

  const confirm = page.getByRole("alertdialog")
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: /xóa/i }).click()

  await expect
    .poll(
      async () =>
        (await db().from("blog_posts").select("id").eq("slug", SLUG)).data
          ?.length,
    )
    .toBe(0)
})
