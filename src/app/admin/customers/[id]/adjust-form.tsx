"use client"

import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import {
  fieldValue,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useT } from "@/lib/i18n/provider"
import { formatVnd } from "@/lib/utils"
import {
  makeAdjustSchema,
  NO_SELECTION,
  type AdjustFormValues,
  type AdjustInput,
} from "@/lib/schemas"
import type { CustomerRow, MembershipTierRow } from "@/lib/db-types"
import { adjustPoints } from "./actions"

// Radix Select refuses value="" — see NO_SELECTION in src/lib/schemas.ts.
const NO_TIER = NO_SELECTION

/**
 * Staff grant of tier and points.
 *
 * "Grant tier" writes `customers.tier_id` outright (0012). It deliberately does
 * NOT move `lifetime_spend`: that column is money the shop actually took, and
 * the percentile rules behind scheduled threshold raises rank the member base by
 * it — inventing spend here would quietly bend every one of those.
 */
export function AdjustForm({
  customer,
  tiers,
}: {
  customer: CustomerRow
  tiers: MembershipTierRow[]
}) {
  const t = useT()
  const m = t.admin.customers.detail.adjust
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<AdjustInput | null>(null)

  const form = useForm<AdjustFormValues, unknown, AdjustInput>({
    resolver: zodResolver(makeAdjustSchema(t.validation)),
    defaultValues: {
      customer_id: customer.id,
      current_delta: 0,
      lifetime_delta: 0,
      grant_tier_id: NO_TIER,
      reason: "",
    },
  })

  // Mirrors the RPC's arithmetic so the admin sees the outcome before they
  // commit to it. Kept deliberately simple — the server is still the authority.
  const toInt = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
  }
  // useWatch rather than form.watch(): the latter returns a fresh function each
  // render, which opts the whole component out of the React Compiler.
  const [grantId, currentDelta, lifetimeDelta] = useWatch({
    control: form.control,
    name: ["grant_tier_id", "current_delta", "lifetime_delta"],
  })
  const nextCurrent = customer.current_points + toInt(currentDelta)
  const nextLifetime = customer.lifetime_points + toInt(lifetimeDelta)

  // Only tiers ABOVE the one held are offerable: the RPC refuses anything else,
  // and the list used to be filtered by a points total that no longer decides
  // anything. Thresholds, not sort_order — sort_order is free-form display order.
  const heldThreshold =
    tiers.find((tier) => tier.id === customer.tier_id)?.spend_threshold ?? null
  const grantable = [...tiers]
    .sort((a, b) => a.spend_threshold - b.spend_threshold)
    .filter(
      (tier) => heldThreshold == null || tier.spend_threshold > heldThreshold,
    )
  const nextTier = grantable.find((tier) => tier.id === grantId) ?? null

  // Validated by handleSubmit as before — only the actual write moves behind
  // the confirmation dialog below, since this is the largest-blast-radius
  // action in the admin (unbounded balance/tier change, applied immediately).
  function openConfirm(values: AdjustInput) {
    setPendingValues(values)
    setConfirmOpen(true)
  }

  function confirmSubmit() {
    if (!pendingValues) return
    startTransition(async () => {
      const state = await adjustPoints(pendingValues)
      if (!state?.ok) {
        form.setError("root", { message: state?.message ?? m.saveFailed })
        toast.error(state?.message ?? m.saveFailed)
        setConfirmOpen(false)
        return
      }
      toast.success(state.message)
      form.reset({
        customer_id: customer.id,
        current_delta: 0,
        lifetime_delta: 0,
        grant_tier_id: NO_TIER,
        reason: "",
      })
      setConfirmOpen(false)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(openConfirm)} className="grid gap-6">
        <p className="text-body-sm text-muted-foreground">{m.helper}</p>

        <FormField
          control={form.control}
          name="grant_tier_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.grantTier}</FormLabel>
              <Select
                value={fieldValue(field.value)}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_TIER}>{m.noTierGrant}</SelectItem>
                  {grantable.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {m.tierOption(tier.name, formatVnd(tier.spend_threshold))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{m.grantTierHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="current_delta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.currentDelta}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.currentDeltaHelper}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lifetime_delta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.lifetimeDelta}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.lifetimeDeltaHelper}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.reason}</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} value={fieldValue(field.value)} />
              </FormControl>
              <FormDescription>{m.reasonHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border-border bg-surface-container grid gap-1 rounded-lg border px-4 py-3">
          <p className="text-label-md text-muted-foreground tracking-wider uppercase">
            {m.preview}
          </p>
          <p className="text-body-sm font-semibold tabular-nums">
            {`${m.currentDelta}: ${customer.current_points.toLocaleString()} → ${nextCurrent.toLocaleString()}`}
          </p>
          <p className="text-body-sm font-semibold tabular-nums">
            {`${m.lifetimeDelta}: ${customer.lifetime_points.toLocaleString()} → ${nextLifetime.toLocaleString()}`}
          </p>
          {/* The tier after this change: the granted one, or the one they
              already hold — nothing else here can move it any more. */}
          <p className="text-body-sm text-muted-foreground">
            {nextTier?.name ??
              tiers.find((tier) => tier.id === customer.tier_id)?.name ??
              t.admin.customers.detail.noTier}
          </p>
        </div>

        <FormError message={form.formState.errors.root?.message} />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t.common.saving : m.submit}
          </Button>
        </div>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{m.confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit} disabled={isPending}>
              {isPending ? t.common.saving : m.confirmCta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  )
}
