import { expect, type Locator, type Page } from "@playwright/test"

/**
 * Every page under test is a Server Component streamed in behind a
 * `loading.tsx` skeleton, and its forms are React Hook Form clients that mount
 * with `defaultValues`. That leaves a window where the markup is complete —
 * visible, enabled, focusable, so Playwright's actionability checks all pass —
 * but no listener is attached yet. A click in that window is swallowed; a fill
 * is wiped by the first client render.
 *
 * There is no hydration event to await, so these helpers do the only reliable
 * thing: act, check whether it took, and act again if it did not.
 *
 * If EVERY interaction in a spec fails here rather than the odd flaky one, the
 * page is not hydrating at all — check that `baseURL` uses the origin Next's
 * dev server trusts (see the note in `playwright.config.ts`), because a blocked
 * `/_next/*` chunk looks exactly like a very slow hydration.
 */

const SETTLE_MS = 400
const TRIES = 10

/** Types into a field and keeps typing until the value survives hydration. */
export async function fillStable(field: Locator, value: string) {
  await field.waitFor()

  for (let attempt = 0; attempt < TRIES; attempt++) {
    await field.fill(value)
    // Two beats, not one: the first client render can land after the fill, and
    // a value that was wiped looks identical to one that never took.
    await field.page().waitForTimeout(SETTLE_MS)
    if ((await field.inputValue()) !== value) continue
    await field.page().waitForTimeout(SETTLE_MS)
    if ((await field.inputValue()) === value) return
  }

  expect(await field.inputValue(), "the field never kept its value").toBe(value)
}

/**
 * Clicks until `settled` appears.
 *
 * Each attempt waits properly for `settled` rather than probing instantly:
 * probing would call a slow-but-working open a failure and click again, which
 * on a toggle (a dialog trigger, a menu) closes the very thing being waited on.
 */
export async function clickStable(target: Locator, settled: Locator) {
  for (let attempt = 0; attempt < TRIES; attempt++) {
    await target.click()
    try {
      await settled.waitFor({ state: "visible", timeout: 2_000 })
      return
    } catch {
      // Not hydrated yet — the click went nowhere, so there is nothing to undo.
    }
  }

  await expect(settled, "the control never responded to a click").toBeVisible()
}

/** Opens a Base UI Select and picks an option. */
export async function chooseOption(
  page: Page,
  comboboxName: string,
  optionName: RegExp | string,
) {
  const option = page.getByRole("option", { name: optionName })
  await clickStable(page.getByRole("combobox", { name: comboboxName }), option)
  await option.click()
}
