// Pure milestone helpers. Kept out of `loyalty.ts` for the same reason as
// `spin.ts` and `rewards.ts`: that module pulls in the service-role Supabase
// client, and the roadmap's node — with its claim button — is a client
// component. Nothing here may import `server-only`.

import type { MilestoneAwardRow, RewardRow } from "@/lib/db-types"

/**
 * `claimed` beats spend. Once an award row exists the rung stays claimed
 * forever, even if a later refund drops `lifetime_spend` back below it — the
 * same sticky posture as `customers.tier_id`, and the reason the award row is
 * the authority here rather than the arithmetic.
 */
export type MilestoneState = "claimed" | "claimable" | "locked"

export type MilestoneNode = {
  milestone: RewardRow
  state: MilestoneState
  /** The claim, once made. Carries the frozen name and the hand-over status. */
  award: MilestoneAwardRow | null
  /** Đồng still to spend. Always 0 unless `state` is "locked". */
  shortfall: number
}

/**
 * The ladder as the member sees it. `milestones` must already be sorted by
 * threshold — `getMilestones()` orders by it, matching
 * `rewards_milestone_threshold_idx` and the roadmap's render order.
 */
export function buildRoadmap(
  milestones: RewardRow[],
  lifetimeSpend: number,
  awards: MilestoneAwardRow[],
): MilestoneNode[] {
  // Awards whose rung was deleted carry a null milestone_id (`on delete set
  // null`); they can never match, and skipping them keeps the map honest.
  const byMilestone = new Map<string, MilestoneAwardRow>()
  for (const award of awards) {
    if (award.milestone_id) byMilestone.set(award.milestone_id, award)
  }

  return milestones.map((milestone) => {
    const award = byMilestone.get(milestone.id) ?? null
    // A milestone always has a threshold — 0024 constrains it — but the column
    // is nullable for the other two kinds, so this narrows rather than trusts.
    const threshold = milestone.spend_threshold ?? 0
    const reached = lifetimeSpend >= threshold

    const state: MilestoneState = award
      ? "claimed"
      : reached
        ? "claimable"
        : "locked"

    return {
      milestone,
      state,
      award,
      shortfall: state === "locked" ? Math.max(0, threshold - lifetimeSpend) : 0,
    }
  })
}

/**
 * How far down the rail the filled track runs, 0–100. Measured in RUNGS, not in
 * đồng: the nodes are evenly spaced on screen, so a spend-proportional fill
 * would stop between two of them and read as a rendering bug.
 *
 * Shared by the roadmap and the dashboard card so the two cannot disagree.
 */
export function roadmapProgress(nodes: MilestoneNode[]): number {
  if (nodes.length === 0) return 0
  const reached = nodes.filter((node) => node.state !== "locked").length
  return Math.round((reached / nodes.length) * 100)
}

/** Rungs reached but not yet claimed — the count the dashboard nudges about. */
export function claimableCount(nodes: MilestoneNode[]): number {
  return nodes.filter((node) => node.state === "claimable").length
}

/** The cheapest rung still out of reach, or null at the top of the ladder. */
export function nextLocked(nodes: MilestoneNode[]): MilestoneNode | null {
  return nodes.find((node) => node.state === "locked") ?? null
}

/**
 * The magnitude behind a node's short label — 400_000 → 400 thousand,
 * 1_200_000 → 1.2 million. Returns the NUMBER and its unit, never a formatted
 * string: the "k" / "tr" suffix is Vietnamese and belongs in the message
 * catalog, not in a helper every locale has to share.
 */
export function thresholdMagnitude(dong: number): {
  value: number
  unit: "thousand" | "million"
} {
  if (dong >= 1_000_000) {
    // One decimal: the ladder's rungs are 400k apart at the bottom and 1tr+
    // apart at the top, and rounding 1.2tr to 1tr would collide with the rung
    // below it.
    return { value: Math.round((dong / 1_000_000) * 10) / 10, unit: "million" }
  }
  return { value: Math.round(dong / 1_000), unit: "thousand" }
}
