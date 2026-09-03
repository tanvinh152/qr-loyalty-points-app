import { expect, test } from "@playwright/test"

import { db } from "./fixtures/db"

/**
 * The pages outside the auth guard.
 *
 * `/faq`, `/terms` and `/blog` are deliberately ungated — `/register` links to
 * `/terms` and `/terms#privacy` before an account exists, so guarding them
 * would make the terms unreadable to the only people who need to agree to them.
 * `guest-guards.spec.ts` owns the other half of this rule (what IS guarded).
 */

test("the QR landing sends a stranger to the login", async ({ page }) => {
  // `/` is what the printed QR code points at.
  await page.goto("/")
  await expect(page).toHaveURL(/\/login/)
})

test("the terms and the privacy section are readable signed out", async ({
  page,
}) => {
  await page.goto("/terms")
  await expect(page.getByRole("heading").first()).toBeVisible()

  // Same page, second section — the register form links straight to the anchor.
  await page.goto("/terms#privacy")
  await expect(page.locator("#privacy")).toBeVisible()
})

test("the FAQ is readable signed out", async ({ page }) => {
  await page.goto("/faq")
  await expect(page.getByRole("heading").first()).toBeVisible()
})

test("the register form links to both documents it asks agreement to", async ({
  page,
}) => {
  await page.goto("/register")
  await expect(page.getByRole("link", { name: /điều khoản/i })).toHaveAttribute(
    "href",
    "/terms",
  )
  await expect(page.getByRole("link", { name: /bảo mật/i })).toHaveAttribute(
    "href",
    "/terms#privacy",
  )
})

test("only published posts reach the public blog", async ({ page }) => {
  await db().from("blog_posts").delete().like("slug", "e2e-public-%")
  const { error } = await db()
    .from("blog_posts")
    .insert([
      {
        title: "E2E Đã đăng",
        slug: "e2e-public-live",
        content: "Nội dung công khai.",
        post_type: "article",
        is_published: true,
        published_at: new Date().toISOString(),
      },
      {
        title: "E2E Còn nháp",
        slug: "e2e-public-draft",
        content: "Nội dung nháp.",
        post_type: "article",
        is_published: false,
      },
    ])
  if (error) throw new Error(error.message)

  await page.goto("/blog")
  await expect(page.getByText("E2E Đã đăng").first()).toBeVisible()
  await expect(page.getByText("E2E Còn nháp")).toHaveCount(0)

  // And the draft is not reachable by guessing its URL either. The lookup pins
  // `is_published = true` and the page renders its own "no such post" state, so
  // this is a 200 carrying nothing — a draft and a typo are indistinguishable
  // to a stranger, which is the point.
  await page.goto("/blog/e2e-public-draft")
  await expect(page.getByText(/không tìm thấy bài viết/i)).toBeVisible()
  await expect(page.getByText("Nội dung nháp.")).toHaveCount(0)

  await db().from("blog_posts").delete().like("slug", "e2e-public-%")
})
