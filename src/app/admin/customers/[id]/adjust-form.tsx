"use client"

import { useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

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
import {
  makeAdjustSchema,
  type AdjustFormValues,
  type AdjustInput,
} from "@/lib/schemas"
import type { CustomerRow, MembershipTierRow } from "@/lib/db-types"
import { adjustPoints } from "./actions"

const NO_TIER = ""

/**
 * Staff grant of tier and points. "Grant tier" is a lifetime-points floor rather
 * than a tier assignment — see the header of 0008_adjust_rpc.sql for why writing
 * tier_id directly would be undone by the customer's next claim.
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
  const threshold = tiers.find((tier) => tier.id === grantId)?.threshold ?? 0
  const nextCurrent = customer.current_points + toInt(currentDelta)
  const nextLifetime = Math.max(
    customer.lifetime_points + toInt(lifetimeDelta),
    grantId ? threshold : 0,
  )
  const nextTier = [...tiers]
    .sort((a, b) => a.threshold - b.threshold)
    .filter((tier) => tier.threshold <= nextLifetime)
    .at(-1)

  function onSubmit(values: AdjustInput) {
    startTransition(async () => {
      const state = await adjustPoints(values)
      if (!state?.ok) {
        form.setError("root", { message: state?.message ?? m.saveFailed })
        toast.error(state?.message ?? m.saveFailed)
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
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
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
                items={[
                  { value: NO_TIER, label: m.noTierGrant },
                  ...tiers.map((tier) => ({
                    value: tier.id,
                    label: m.tierOption(tier.name, tier.threshold),
                  })),
                ]}
              >
                <FormControl>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_TIER}>{m.noTierGrant}</SelectItem>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {m.tierOption(tier.name, tier.threshold)}
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
          <p className="text-body-sm text-muted-foreground">
            {nextTier?.name ?? t.admin.customers.detail.noTier}
          </p>
        </div>

        <FormError message={form.formState.errors.root?.message} />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t.common.saving : m.submit}
          </Button>
        </div>
      </form>
    </Form>
  )
}
