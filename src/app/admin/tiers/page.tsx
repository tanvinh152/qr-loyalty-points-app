import { Medal } from "lucide-react"

import { ConfirmDelete } from "@/components/confirm-delete"
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
import { getMessages } from "@/lib/i18n/server"
import type { MembershipTierRow } from "@/lib/db-types"
import { TierDialog } from "./tier-form"
import { deleteTier } from "./actions"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.tiers.metaTitle }
}

export default async function TiersPage() {
  const t = await getMessages()
  const m = t.admin.tiers
  const supabase = await createClient()
  const { data } = await supabase
    .from("membership_tiers")
    .select("*")
    .order("sort_order", { ascending: true })

  const tiers = (data ?? []) as MembershipTierRow[]

  return (
    <div className="grid gap-6">
      <PageHeader title={m.title} description={m.helper} />

      <SectionCard title={m.listTitle} actions={<TierDialog />}>
        {tiers.length === 0 ? (
          <EmptyState title={m.empty} icon={Medal} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.name}</TableHead>
                <TableHead className="text-right">{m.threshold}</TableHead>
                <TableHead className="text-right">{m.multiplier}</TableHead>
                <TableHead>{m.perks}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
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
                    {tier.threshold.toLocaleString()}
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
                      <ConfirmDelete
                        name={tier.name}
                        onConfirm={deleteTier.bind(null, tier.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
