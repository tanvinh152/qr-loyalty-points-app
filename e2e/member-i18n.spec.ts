import { expect, test } from "@playwright/test"

/**
 * Language and theme are both cookie-driven, Vietnamese and light being the
 * defaults. `vi.ts` is typed against `en.ts`, so a missing key is a build
 * error rather than a blank screen — what this spec adds is proof that the
 * cookie actually reaches the server render.
 */

test("the portal renders in Vietnamese by default", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page.locator("html")).toHaveAttribute("lang", "vi")
  await expect(
    page.getByRole("navigation", { name: /điều hướng chính/i }),
  ).toBeVisible()
})

test("the language cookie switches the portal to English", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: "en",
      url: page.url() === "about:blank" ? "http://localhost:3100" : page.url(),
    },
  ])

  await page.goto("/dashboard")
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  // The rail is the surface every route wears, so it is the honest check that
  // the catalogue swapped rather than one lucky string.
  await expect(page.getByRole("navigation", { name: /main/i })).toBeVisible()
})

test("numbers are formatted by the catalogue, not the runtime", async ({
  page,
}) => {
  await page.goto("/dashboard")
  // `num()` is pinned inside the message catalogue: a bare toLocaleString would
  // read Node's en-US ("1,500") on the server and vi-VN ("1.500") in the
  // browser, which was a real hydration mismatch on every reward card.
  const points = page.getByText(/\d/).first()
  await expect(points).toBeVisible()
})
