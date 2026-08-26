import Link from "next/link"
import { ArrowLeft, Route, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { SectionCard } from "@/components/section-card"
import { cn, formatVnd } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/server"
import { getMilestoneAwards, getMilestones } from "@/lib/loyalty"
import { buildRoadmap, roadmapProgress } from "@/lib/milestones"
import { getAccount } from "../../account"
import { MilestoneNodeRow } from "./milestone-node"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.roadmap.metaTitle }
}

/**
 * The spend ladder. A sub-route of /rewards rather than a fifth nav item: the
 * rail and the phone bar both match by prefix, so "Rewards" stays highlighted
 * and the header gets its back chevron for free.
 *
 * Measured in ĐỒNG OF SPEND, not points — the shop one level up is the one
 * denominated in points, and keeping the two on separate screens is what stops
 * the units being read for each other.
 */
export default async function RoadmapPage() {
  const t = await getMessages()
  const r = t.customer.roadmap
  const { customer } = await getAccount()
  // The layout renders the "no points account" notice in this case.
  if (!customer) return null

  const [milestones, awards] = await Promise.all([
    getMilestones(),
    getMilestoneAwards(customer.id),
  ])
  const nodes = buildRoadmap(milestones, customer.lifetime_spend, awards)
  const percent = roadmapProgress(nodes)
  // The fade ladder on the locked rungs is measured from the FIRST rung still
  // ahead, not from the top of the page: a member two thirds up would otherwise
  // see their very next reward already greyed out. `buildRoadmap` returns the
  // rungs in threshold order, so every locked one follows this index.
  const firstLocked = nodes.findIndex((node) => node.state === "locked")

  const header = (
    <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-end md:justify-between">
      <PageHeader
        size="display"
        title={
          <>
            {r.title}
            <span className="text-primary">{r.titleAccent}</span>
          </>
        }
        description={r.subtitle}
        eyebrow={<Badge variant="secondary">{r.eyebrow}</Badge>}
      />
      {/* The figure the whole ladder is measured against. Labelled as SPEND:
          the mockup calls this "điểm tích lũy", but the number and every rung
          beside it are đồng, and mislabelling it would invite a member to
          compare it against their points balance. */}
      <div className="border-border bg-card shadow-soft flex shrink-0 items-center gap-4 rounded-3xl border p-4">
        <span className="bg-surface-container text-primary grid size-12 shrink-0 place-items-center rounded-full">
          <Wallet className="size-6" aria-hidden />
        </span>
        <div className="grid gap-0.5">
          <span className="text-label-md text-muted-foreground">
            {r.spendLabel}
          </span>
          <span className="text-headline-md tabular-nums">
            {formatVnd(customer.lifetime_spend)}
          </span>
        </div>
      </div>
    </div>
  )

  const backLink = (
    <Link
      href="/rewards"
      className={cn(buttonVariants({ variant: "muted" }), "w-fit")}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {r.backToRewards}
    </Link>
  )

  if (nodes.length === 0) {
    return (
      <div className="grid gap-4 sm:gap-6">
        {header}
        <SectionCard>
          <EmptyState
            icon={Route}
            title={r.emptyTitle}
            description={r.emptyBody}
            action={backLink}
          />
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:gap-6">
      {header}

      <div className="relative">
        {/* The rail. Both halves are inset by half a marker (32px) so the track
            starts and ends at the centre of the first and last node rather than
            running past them. */}
        <span
          aria-hidden
          className="bg-border absolute top-8 bottom-8 left-8 w-1.5 -translate-x-1/2 rounded-full"
        />
        {/* Height is DATA, so it is an inline style: an arbitrary-value Tailwind
            class cannot be computed at runtime. */}
        <span
          aria-hidden
          className="bg-primary shadow-glow absolute top-8 left-8 w-1.5 -translate-x-1/2 rounded-full transition-all duration-700"
          style={{ height: `calc((100% - 4rem) * ${percent} / 100)` }}
        />

        <ol
          aria-label={r.progressLabel}
          className="relative grid gap-8 md:gap-10"
        >
          {nodes.map((node, index) => (
            <MilestoneNodeRow
              key={node.milestone.id}
              node={node}
              lockedIndex={index - firstLocked}
            />
          ))}
        </ol>
      </div>

      {backLink}
    </div>
  )
}
