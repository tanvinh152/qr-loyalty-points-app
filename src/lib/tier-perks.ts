// Icon keys for `membership_tiers.perks`. The column stores a string, so the
// admin editor and the customer tier screen must agree on the vocabulary — this
// is the one place it is written down. Adding a key here means adding it to the
// `PERK_ICONS` map in `src/app/(customer)/(account)/tiers/page.tsx` too; the
// screen falls back rather than crashing on an unknown one.
//
// The last five were added for the §5.2 benefit matrix in
// docs/Tich_Diem_ChiCha.md. `truck` predates it and no longer appears in
// seed.sql, but it stays in the vocabulary: an admin may already have typed it
// into a live tier, and removing a key would only turn that row's icon into the
// fallback for no gain.
export const PERK_ICON_KEYS = [
  "percent",
  "gift",
  "truck",
  "cake",
  "award",
  "sparkles",
  "wheel",
  "paw",
  "flask",
  "layers",
  "heart",
] as const

export type PerkIconKey = (typeof PERK_ICON_KEYS)[number]

/**
 * The tier screen renders at most this many perks in its grid. Ruby carries
 * eight under §5.2 (the multiplier plus all seven rows of the benefit matrix),
 * which the `sm:grid-cols-2 lg:grid-cols-3` grid lays out as 3+3+2.
 */
export const MAX_PERKS = 8
