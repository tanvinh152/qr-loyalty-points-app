// Which section of a portal a pathname belongs to. The app shell's header shows
// this as a locator above the page's own PageHeader, and — on a sub-route — as
// the target of the back chevron.
//
// Pure and React-free on purpose: the matching rule is the same one PortalNav
// uses to decide the active item, and a second, subtly different copy of it is
// exactly how a header and a rail start disagreeing about where you are.

export type PortalTitle = {
  href: string
  label: string
  /**
   * Match the path exactly instead of by prefix. Needed for a portal root like
   * `/admin`, which would otherwise claim every sub-route.
   */
  exact?: boolean
}

export type ResolvedTitle = {
  label: string
  /**
   * The section's own href, set ONLY when the current path sits below it — that
   * is, when we are on a detail route like `/admin/customers/[id]`. `undefined`
   * on the section's own page, where there is nothing to go back to.
   */
  parent?: string
}

function matches(entry: PortalTitle, pathname: string) {
  if (entry.exact) return pathname === entry.href
  // The trailing slash is load-bearing: without it `/admin/tiersomething`
  // would match `/admin/tiers`.
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`)
}

/**
 * The deepest entry that claims `pathname`, or `null` when nothing does.
 *
 * Nothing is better than a wrong answer here: `/admin/spin/winners` has no nav
 * entry, and labelling it with some ancestor's name would tell the reader they
 * are somewhere they are not. The header simply shows no title instead.
 */
export function resolvePortalTitle(
  titles: PortalTitle[],
  pathname: string,
): ResolvedTitle | null {
  let best: PortalTitle | null = null
  for (const entry of titles) {
    if (!matches(entry, pathname)) continue
    // Longest href wins, so a nested entry beats the section it lives under.
    if (!best || entry.href.length > best.href.length) best = entry
  }
  if (!best) return null
  return {
    label: best.label,
    parent: pathname === best.href ? undefined : best.href,
  }
}
