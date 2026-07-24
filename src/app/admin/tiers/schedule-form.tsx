"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarClock, X } from "lucide-react"
import { toast } from "sonner"

import { FormDialog } from "@/components/form-dialog"
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
  makeTierScheduleSchema,
  type TierScheduleFormValues,
  type TierScheduleInput,
} from "@/lib/schemas"
import type { MembershipTierRow } from "@/lib/db-types"
import {
  cancelTierSchedule,
  previewPercentileAmount,
  saveTierSchedule,
} from "./actions"

/**
 * Queues a raise of one tier's spend threshold.
 *
 * Two modes, because the shop reasons about the ladder both ways: a fixed
 * amount now, and "the top N% of spenders" once the member base is large enough
 * for a percentile to mean anything. A percentile is resolved to đồng on the
 * effective date and frozen there — see 0010_spend_tiers.sql.
 */
export function ScheduleDialog({
  tiers,
  tierId,
}: {
  tiers: MembershipTierRow[]
  /** Pre-selects a tier when the dialog is opened from that tier's row. */
  tierId?: string
}) {
  const t = useT()
  const m = t.admin.tiers

  return (
    <FormDialog
      title={m.scheduleTitle}
      description={m.scheduleHelper}
      trigger={
        <Button type="button" variant="outline">
          <CalendarClock aria-hidden />
          {m.scheduleTitle}
        </Button>
      }
    >
      {(close) => (
        <ScheduleFields tiers={tiers} tierId={tierId} onSaved={close} />
      )}
    </FormDialog>
  )
}

function ScheduleFields({
  tiers,
  tierId,
  onSaved,
}: {
  tiers: MembershipTierRow[]
  tierId?: string
  onSaved: () => void
}) {
  const t = useT()
  const m = t.admin.tiers
  const [isPending, startTransition] = useTransition()
  // Tagged with the percentile it answers, so a stale reply for a half-typed
  // number can never be shown beside a different one.
  const [preview, setPreview] = useState<{
    pct: number
    amount: number | null
  } | null>(null)

  const form = useForm<TierScheduleFormValues, unknown, TierScheduleInput>({
    resolver: zodResolver(makeTierScheduleSchema(t.validation)),
    defaultValues: {
      tier_id: tierId ?? tiers[0]?.id ?? "",
      mode: "amount",
      target_amount: "",
      target_percentile: "",
      effective_at: "",
      note: "",
    },
  })

  // useWatch rather than form.watch(): the latter returns a fresh function each
  // render, which opts the whole component out of the React Compiler.
  const [mode, percentile] = useWatch({
    control: form.control,
    name: ["mode", "target_percentile"],
  })

  // Derived rather than stored: whether there is anything to ask about is a pure
  // function of the form, so only the answer needs state.
  const typed = Number(percentile)
  const askFor =
    mode === "percentile" && Number.isFinite(typed) && typed > 0 && typed < 100
      ? typed
      : null

  // The preview is a live read of the member base, so it is fetched rather than
  // computed. Debounced: the field is typed into digit by digit.
  useEffect(() => {
    if (askFor == null) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const amount = await previewPercentileAmount(askFor)
      if (!cancelled) setPreview({ pct: askFor, amount })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [askFor])

  const previewAmount =
    askFor != null && preview?.pct === askFor ? preview.amount : null

  function onSubmit(values: TierScheduleInput) {
    startTransition(async () => {
      const state = await saveTierSchedule(values)
      if (!state?.ok) {
        // Pinned in the dialog as well as toasted — the toast can land behind
        // the overlay on a phone.
        form.setError("root", { message: state?.message ?? m.scheduleSaveFailed })
        toast.error(state?.message ?? m.scheduleSaveFailed)
        return
      }
      toast.success(state.message)
      onSaved()
    })
  }

  const modes = [
    { value: "amount", label: m.amountMode },
    { value: "percentile", label: m.percentileMode },
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <FormField
          control={form.control}
          name="tier_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.scheduleTier}</FormLabel>
              <Select
                value={fieldValue(field.value)}
                onValueChange={field.onChange}
                items={tiers.map((tier) => ({
                  value: tier.id,
                  label: `${tier.name} — ${formatVnd(tier.spend_threshold)}`,
                }))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {`${tier.name} — ${formatVnd(tier.spend_threshold)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.scheduleMode}</FormLabel>
              <Select
                value={fieldValue(field.value)}
                onValueChange={field.onChange}
                items={modes}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {modes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {mode === "percentile" ? m.percentileModeHelper : m.amountModeHelper}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Only the field the chosen mode uses is rendered: the constraint in
            0010 insists the other column is NULL, so offering both would invite
            a payload the database refuses. */}
        {mode === "amount" ? (
          <FormField
            control={form.control}
            name="target_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.targetAmount}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="target_percentile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.targetPercentile}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0.01"
                    max="99.99"
                    step="0.01"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>
                  {previewAmount == null
                    ? askFor != null
                      ? t.common.loading
                      : m.percentileModeHelper
                    : previewAmount > 0
                      ? m.schedulePreviewHint(formatVnd(previewAmount))
                      : m.schedulePreviewEmpty}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="effective_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.effectiveAt}</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  {...field}
                  value={fieldValue(field.value)}
                />
              </FormControl>
              <FormDescription>{m.effectiveAtHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.scheduleNote}</FormLabel>
              <FormControl>
                <Input {...field} value={fieldValue(field.value)} />
              </FormControl>
              <FormDescription>{m.scheduleNoteHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormError message={form.formState.errors.root?.message} />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t.common.saving : m.scheduleSubmit}
          </Button>
        </div>
      </form>
    </Form>
  )
}

/** Drops a queued raise. Only ever rendered for a pending one. */
export function CancelSchedule({ id }: { id: string }) {
  const t = useT()
  const m = t.admin.tiers
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={m.scheduleCancel}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const state = await cancelTierSchedule(id)
          if (state?.ok) toast.success(state.message)
          else toast.error(state?.message ?? m.scheduleCancelFailed)
        })
      }
    >
      <X aria-hidden />
    </Button>
  )
}
