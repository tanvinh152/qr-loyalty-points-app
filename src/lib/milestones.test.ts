import { describe, expect, it } from "vitest"

import type { MilestoneAwardRow, RewardRow } from "@/lib/db-types"
import {
  buildRoadmap,
  claimableCount,
  nextLocked,
  roadmapProgress,
  thresholdMagnitude,
} from "./milestones"

function rung(id: string, spend_threshold: number): RewardRow {
  return {
    id,
    kind: "milestone",
    name: `Rung ${id}`,
    description: null,
    points_cost: 0,
    quantity: 0,
    image_url: null,
    category: null,
    is_exclusive: false,
    is_featured: false,
    is_active: true,
    min_tier_id: null,
    created_at: "2026-01-01T00:00:00Z",
    prize_type: "none",
    points_amount: 0,
    weight: 0,
    sort_order: 0,
    spend_threshold,
  }
}

function award(milestone_id: string | null): MilestoneAwardRow {
  return {
    id: `award-${milestone_id ?? "orphan"}`,
    customer_id: "customer-1",
    milestone_id,
    milestone_name: "Frozen name",
    threshold_amount: 400_000,
    spend_at_claim: 400_000,
    fulfilled_at: null,
    fulfilled_by: null,
    created_at: "2026-01-01T00:00:00Z",
  }
}

const LADDER = [rung("a", 400_000), rung("b", 1_200_000), rung("c", 2_000_000)]

describe("buildRoadmap", () => {
  it("unlocks a rung the moment spend EQUALS it, not a đồng later", () => {
    // The boundary is the whole contract: "spend 400.000đ and the gift is
    // yours" has to be true at exactly 400.000đ.
    const [node] = buildRoadmap([rung("a", 400_000)], 400_000, [])
    expect(node.state).toBe("claimable")
    expect(node.shortfall).toBe(0)
  })

  it("locks a rung one đồng short and reports the gap", () => {
    const [node] = buildRoadmap([rung("a", 400_000)], 399_999, [])
    expect(node.state).toBe("locked")
    expect(node.shortfall).toBe(1)
  })

  it("keeps a claimed rung claimed even when spend later falls below it", () => {
    // The refund case. The award row is never retracted — same posture as the
    // sticky customers.tier_id — so the arithmetic must not overrule it.
    const [node] = buildRoadmap([rung("a", 400_000)], 0, [award("a")])
    expect(node.state).toBe("claimed")
    expect(node.shortfall).toBe(0)
  })

  it("never reports a negative shortfall", () => {
    const nodes = buildRoadmap(LADDER, 9_000_000, [])
    expect(nodes.every((n) => n.shortfall >= 0)).toBe(true)
  })

  it("ignores an award whose rung was deleted", () => {
    // `on delete set null` leaves orphan awards behind; matching them to a
    // rung by accident would mark an unrelated gift as already claimed.
    const nodes = buildRoadmap(LADDER, 0, [award(null)])
    expect(nodes.map((n) => n.state)).toEqual(["locked", "locked", "locked"])
  })

  it("preserves the ladder's ascending order", () => {
    const nodes = buildRoadmap(LADDER, 1_500_000, [award("a")])
    expect(nodes.map((n) => n.milestone.id)).toEqual(["a", "b", "c"])
    expect(nodes.map((n) => n.state)).toEqual([
      "claimed",
      "claimable",
      "locked",
    ])
  })
})

describe("roadmapProgress", () => {
  it("is 0 with nothing reached and 100 at the top", () => {
    expect(roadmapProgress(buildRoadmap(LADDER, 0, []))).toBe(0)
    expect(roadmapProgress(buildRoadmap(LADDER, 2_000_000, []))).toBe(100)
    expect(roadmapProgress(buildRoadmap(LADDER, 99_000_000, []))).toBe(100)
  })

  it("never decreases as spend rises", () => {
    const spends = [0, 400_000, 1_200_000, 1_999_999, 2_000_000]
    const percents = spends.map((s) =>
      roadmapProgress(buildRoadmap(LADDER, s, [])),
    )
    expect(percents).toEqual([...percents].sort((a, b) => a - b))
  })

  it("is 0 for an empty ladder rather than dividing by zero", () => {
    expect(roadmapProgress([])).toBe(0)
  })
})

describe("claimableCount / nextLocked", () => {
  it("counts only the rungs that are reached AND unclaimed", () => {
    const nodes = buildRoadmap(LADDER, 1_500_000, [award("a")])
    expect(claimableCount(nodes)).toBe(1)
  })

  it("points at the cheapest rung still out of reach", () => {
    const nodes = buildRoadmap(LADDER, 1_500_000, [award("a")])
    expect(nextLocked(nodes)?.milestone.id).toBe("c")
  })

  it("has no next rung at the top of the ladder", () => {
    expect(nextLocked(buildRoadmap(LADDER, 2_000_000, []))).toBeNull()
  })
})

describe("thresholdMagnitude", () => {
  it("splits at a million and keeps one decimal above it", () => {
    // 1.2tr must not round to 1tr: the rung below it is 400k and the labels
    // have to stay distinguishable.
    expect(thresholdMagnitude(400_000)).toEqual({
      value: 400,
      unit: "thousand",
    })
    expect(thresholdMagnitude(1_200_000)).toEqual({
      value: 1.2,
      unit: "million",
    })
    expect(thresholdMagnitude(9_500_000)).toEqual({
      value: 9.5,
      unit: "million",
    })
    expect(thresholdMagnitude(1_000_000)).toEqual({ value: 1, unit: "million" })
  })
})
