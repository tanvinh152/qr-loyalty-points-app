import { Gem } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { SectionCard } from "@/components/section-card"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { getPendingTierSchedules } from "@/lib/loyalty"
import { formatVnd } from "@/lib/utils"
import type { MembershipTierRow } from "@/lib/db-types"
import { TierDialog } from "./tier-form"
import { CancelSchedule, ScheduleDialog } from "./schedule-form"
import { applyDueTierSchedules } from "./actions"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.tiers.metaTitle }
}

export default async function TiersPage() {
  const t = await getMessages()
  const m = t.admin.tiers
  const locale = await getLocale()

  // Applied before the read, not after: without a cron configured this page is
  // the only thing that ever fires a due raise, and a stale threshold rendered
  // here is the one place an admin would notice. Idempotent — see the RPC.
  await applyDueTierSchedules()

  const supabase = await createClient()
  const [{ data }, pending] = await Promise.all([
    supabase
      .from("membership_tiers")
      .select("*")
      .order("sort_order", { ascending: true }),
    getPendingTierSchedules(),
  ])

  const tiers = (data ?? []) as MembershipTierRow[]
  const dateTime = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <div className="grid gap-6">
      <PageHeader title={m.title} description={m.helper} />

      <SectionCard
        title={m.listTitle}
        actions={
          // The five tiers are a fixed ladder — admins adjust them, never add or
          // remove. Only the schedule (a threshold raise) is an "add" here.
          tiers.length > 0 ? <ScheduleDialog tiers={tiers} /> : undefined
        }
      >
        {tiers.length === 0 ? (
          <EmptyState title={m.empty} icon={Gem} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.name}</TableHead>
                <TableHead className="text-right">{m.spendThreshold}</TableHead>
                <TableHead>{m.pendingThreshold}</TableHead>
                <TableHead className="text-right">{m.multiplier}</TableHead>
                <TableHead>{m.perks}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => {
                const queued = pending[tier.id]
                return (
                <TableRow key={tier.id}>
                  <TableCell>
                    <p className="text-body-sm leading-tight font-semibold">
                      {tier.name}
                    </p>
                    <p className="text-muted-foreground text-label-md">
                      {m.sortOrder} {tier.sort_order}
                    </p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatVnd(tier.spend_threshold)}
                  </TableCell>
                  <TableCell>
                    {queued ? (
                      <div className="flex items-center gap-1">
                        <div className="grid gap-0.5">
                          {/* A percentile has no amount until it fires, so the
                              rule itself is what the column shows. */}
                          <span className="text-body-sm tabular-nums">
                            {queued.mode === "amount"
                              ? formatVnd(queued.target_amount ?? 0)
                              : m.percentileLabel(queued.target_percentile ?? 0)}
                          </span>
                          <span className="text-muted-foreground text-body-xs">
                            {m.effectiveOn(
                              dateTime.format(new Date(queued.effective_at)),
                            )}
                          </span>
                        </div>
                        <CancelSchedule id={queued.id} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-body-xs">
                        {m.pendingNone}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-primary text-right font-bold tabular-nums">
                    ×{tier.multiplier}
                  </TableCell>
                  <TableCell>
                    {/* `perks` is what the customer screen renders, so the list
                        reports on it rather than on the legacy free text. */}
                    {tier.perks?.length ? (
                      <div className="grid gap-1">
                        <Badge variant="secondary">
                          {m.perkCount(tier.perks.length)}
                        </Badge>
                        <span className="text-muted-foreground text-body-xs">
                          {tier.perks[0].title}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <TierDialog row={tier} />
                    </div>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
