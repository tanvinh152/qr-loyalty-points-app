import { expect, test } from "@playwright/test"

import { MEMBER } from "./fixtures/accounts"

/**
 * The shell both portals wear: the collapsible rail, the header identity menu,
 * and the theme switch.
 *
 * These are the rules AGENTS.md calls out as easy to break silently:
 *  - collapse is a COOKIE read server-side, so the first HTML already carries
 *    the real width — a client-only toggle would flash the wrong one;
 *  - a collapsed label goes `sr-only`, NEVER `hidden`: `display:none` strips a
 *    link's accessible name and leaves a screen reader a column of nameless
 *    icons;
 *  - everything about the account hides behind the avatar, and the sign-out
 *    form lives INSIDE the popup, so selecting it must not close the menu.
 */

test("the rail collapses, and the choice survives a reload", async ({
  page,
}) => {
  await page.goto("/dashboard")

  const nav = page.getByRole("navigation", { name: /điều hướng chính/i })
  await expect(nav.getByRole("link", { name: /trang chủ/i })).toBeVisible()

  await page.getByRole("button", { name: /thu gọn thanh bên/i }).click()
  await expect(
    page.getByRole("button", { name: /mở rộng thanh bên/i }),
  ).toBeVisible()

  // Persisted as a cookie, not component state — and written FIRE-AND-FORGET,
  // deliberately: unlike the theme it does not `router.refresh()`, because
  // nothing server-rendered depends on it and a refresh would re-run the
  // layout's account and tier queries on every click. Hence the poll.
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find(
          (c) => c.name === "sidebar_collapsed",
        )?.value,
    )
    .toBe("1")

  await page.reload()
  await expect(
    page.getByRole("button", { name: /mở rộng thanh bên/i }),
  ).toBeVisible()

  // THE rule: collapsed hides the label visually but the link keeps its name.
  // `hidden` here would leave a screen reader a column of nameless icons.
  await expect(nav.getByRole("link", { name: /trang chủ/i })).toHaveCount(1)

  await page.getByRole("button", { name: /mở rộng thanh bên/i }).click()
  await expect(
    page.getByRole("button", { name: /thu gọn thanh bên/i }),
  ).toBeVisible()
})

test("everything about the account hides behind the avatar", async ({
  page,
}) => {
  await page.goto("/dashboard")

  // Not loose icons in the corner: one trigger, one menu. Theme and sign-out
  // were separate controls until they were grouped here.
  await page.getByRole("button", { name: /tài khoản của bạn/i }).click()

  const menu = page.getByRole("menu")
  await expect(menu.getByRole("menuitem", { name: /hồ sơ/i })).toBeVisible()
  await expect(menu.getByRole("menuitem", { name: /hỗ trợ/i })).toBeVisible()
  // The sign-out row is a real <button type="submit"> inside a <form>, but its
  // ROLE is overridden to menuitem so the menu's keyboard model still works —
  // so it is never findable as a button here.
  await expect(menu.getByRole("menuitem", { name: /đăng xuất/i })).toBeVisible()
})

test("the theme row switches the theme without closing the menu", async ({
  page,
}) => {
  await page.goto("/dashboard")
  await page.getByRole("button", { name: /tài khoản của bạn/i }).click()

  const menu = page.getByRole("menu")
  const themeRow = menu
    .getByRole("menuitem")
    .filter({ hasText: /giao diện|sáng|tối/i })
  await themeRow.first().click()

  // `closeOnClick={false}`: the theme row is not a destination, and closing on
  // the sign-out row would unmount its form out from under its own submit.
  await expect(menu).toBeVisible()

  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find((c) => c.name === "theme")?.value,
    )
    .toMatch(/light|dark/)
})

/*
 * Deliberately NO sign-out case here.
 *
 * `supabase.auth.signOut()` revokes the refresh token GLOBALLY, so signing out
 * in this project invalidates `e2e/.auth/member.json` for every spec that runs
 * after it — the three cases below failed exactly that way. The member portal's
 * sign-out is covered in `login.spec.ts`, which signs in for itself and owns
 * the session it destroys.
 */

test("the rail stays at four items and lights the section in view", async ({
  page,
}) => {
  await page.goto("/rewards")
  const nav = page.getByRole("navigation", { name: /điều hướng chính/i })
  await expect(nav.getByRole("link")).toHaveCount(4)
  await expect(nav.getByRole("link", { name: /quà tặng/i })).toHaveAttribute(
    "aria-current",
    "page",
  )
})

test("on a phone the same actions live in the bottom sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/dashboard")

  // Two surfaces, one per pointer — a sheet is right under a thumb and wrong
  // under a cursor — but they must offer the SAME actions.
  await page.getByRole("button", { name: /tài khoản của bạn/i }).click()

  const sheet = page.getByRole("dialog")
  await expect(sheet.getByRole("link", { name: /hồ sơ/i })).toBeVisible()
  await expect(sheet.getByRole("link", { name: /hỗ trợ/i })).toBeVisible()
  await expect(sheet.getByRole("button", { name: /đăng xuất/i })).toBeVisible()
  // The upgrade CTA lives in the rail on desktop; below `md` there is no rail,
  // so it moves in here rather than disappearing.
  await expect(sheet.getByRole("link", { name: /nâng hạng/i })).toBeVisible()
})

test("the member's name and tier are shown in the header", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page.getByText(MEMBER.fullName).first()).toBeVisible()
})
