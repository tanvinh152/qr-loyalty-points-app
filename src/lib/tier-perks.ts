// Icon keys for `membership_tiers.perks`. The column stores a string, so the
// admin editor and the customer tier screen must agree on the vocabulary — this
// is the one place it is written down. Adding a key here means adding it to the
// `PERK_ICONS` map in `src/app/(customer)/(account)/tiers/page.tsx` too; the
// screen falls back rather than crashing on an unknown one.

export const PERK_ICON_KEYS = [
  "percent",
  "gift",
  "truck",
  "cake",
  "award",
  "sparkles",
] as const

export type PerkIconKey = (typeof PERK_ICON_KEYS)[number]

/** The tier screen renders at most this many perks in its grid. */
export const MAX_PERKS = 6
