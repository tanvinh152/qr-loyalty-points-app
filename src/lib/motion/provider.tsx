"use client"

import { LazyMotion, MotionConfig, domMax } from "motion/react"

/**
 * The one Motion boundary for all three portals.
 *
 * `reducedMotion="user"` is the JS half of the app-wide policy; the CSS half is
 * the `prefers-reduced-motion` block in globals.css, which covers every
 * class-driven animation. Between them nothing in the app ignores the setting.
 *
 * `domMax`, not `domAnimation`. This changed when ui/ moved onto Animate UI:
 * `primitives/radix/switch.tsx` puts a bare `layout` on the thumb,
 * `primitives/radix/tabs.tsx` uses `layout="size"`, and
 * `primitives/effects/highlight.tsx` moves its box with `layoutId`. Under
 * `domAnimation` all three are IGNORED SILENTLY — no warning, no throw, just a
 * thumb that teleports instead of sliding. There is no way to have those
 * components and the smaller bundle.
 *
 * What `domAnimation` used to buy was a hard guarantee, and it is now only a
 * rule: `layout`/`layoutId` inside the dashboard's 12-column bento would
 * transform a tile out of the cell its span assigned it and leave a hole
 * mid-flight, which is exactly what the bento's no-hole rule exists to prevent.
 * Nothing under src/app/(customer)/(account)/dashboard/ may use either prop.
 *
 * `strict` turns an accidental `<motion.div>` (instead of `<m.div>`) into a
 * throw at dev time rather than a silently unanimated element, and every
 * vendored Animate UI file is rewritten to `m.` on install for that reason.
 *
 * A local wrapper rather than importing MotionConfig into the server layout, so
 * it matches how ThemeProvider and I18nProvider are mounted.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
