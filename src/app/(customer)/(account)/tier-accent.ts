/**
 * Gem colour for a membership tier.
 *
 * Keyed by the tier's *rank* — its zero-based position in the threshold-sorted
 * list — never by name: tier names are admin-editable rows, so `name === "Gold"`
 * would silently stop matching the moment someone renames a tier or runs the
 * programme in Vietnamese. Rank is used rather than `sort_order` because
 * `sort_order` is a free integer an admin can set to anything.
 *
 * Each class sets `--tier` for the local subtree, so children can use
 * `text-tier` / `border-tier` without knowing which tier they are in. The
 * classes are written out in full because Tailwind cannot see interpolated
 * class names.
 */
const ACCENTS = [
  "[--tier:var(--tier-1)] bg-gradient-to-br from-tier-1/12 via-card to-card",
  "[--tier:var(--tier-2)] bg-gradient-to-br from-tier-2/12 via-card to-card",
  "[--tier:var(--tier-3)] bg-gradient-to-br from-tier-3/12 via-card to-card",
  "[--tier:var(--tier-4)] bg-gradient-to-br from-tier-4/12 via-card to-card",
  "[--tier:var(--tier-5)] bg-gradient-to-br from-tier-5/12 via-card to-card",
] as const

/** Neutral card wash for "no tier yet" — the same shape, no gem colour. */
const NO_TIER = "[--tier:var(--muted-foreground)] bg-card"

export function tierAccentClass(rank: number | null | undefined): string {
  if (rank == null || rank < 0) return NO_TIER
  // Tiers past the fifth wrap rather than falling back to neutral: an admin can
  // add a sixth tier and it still gets a colour instead of looking broken.
  return ACCENTS[Math.trunc(rank) % ACCENTS.length]
}

/** Rank of `tierId` within the threshold-sorted list, or null if unranked. */
export function tierRank(
  tiers: { id: string }[],
  tierId: string | null | undefined,
): number | null {
  if (!tierId) return null
  const index = tiers.findIndex((tier) => tier.id === tierId)
  return index < 0 ? null : index
}
