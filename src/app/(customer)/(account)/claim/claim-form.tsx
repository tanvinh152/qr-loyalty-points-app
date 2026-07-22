"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  ArrowRight,
  BadgePercent,
  ChevronDown,
  Gift,
  Loader2,
  PartyPopper,
  PlusCircle,
  Receipt,
  Search,
  Trophy,
  Zap,
} from "lucide-react"

import { FormError } from "@/components/form-error"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { makeOrderCodeSchema } from "@/lib/schemas"
import { useT } from "@/lib/i18n/provider"
import type { ClaimResult } from "@/lib/db-types"
import {
  previewClaim,
  submitClaim,
  type OrderItemView,
  type PreviewResult,
} from "./actions"

type Preview = Extract<PreviewResult, { ok: true }>
type LookupInput = { order_code: string }

/**
 * One field: the order code. The phone is the session's — the member signed in
 * with it — and the server still checks it against the order's masked phone on
 * both calls, so the ownership gate is unchanged.
 */
export function ClaimForm({
  /** Prefilled from `/claim?code=` — see the callout on `/profile`. */
  defaultOrderCode = "",
}: {
  defaultOrderCode?: string
}) {
  const t = useT()
  const c = t.claim
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<ClaimResult | null>(null)
  // Toasts are easy to miss on mobile, so the same message is also pinned
  // inside the card until the next attempt.
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const lookupForm = useForm<LookupInput>({
    resolver: zodResolver(makeOrderCodeSchema(t.validation)),
    defaultValues: { order_code: defaultOrderCode },
  })

  function reportError(message: string) {
    setError(message)
    toast.error(message)
  }

  function reset() {
    setPreview(null)
    setResult(null)
    setError(null)
    lookupForm.reset({ order_code: "" })
  }

  function handleCheck(values: LookupInput) {
    setError(null)
    setPreview(null)
    startTransition(async () => {
      const res = await previewClaim({ order_code: values.order_code })
      if (!res.ok) {
        reportError(res.error)
        return
      }
      setPreview(res)
    })
  }

  function handleClaim() {
    if (!preview) return
    setError(null)
    startTransition(async () => {
      // The canonical id from Pancake is what the server must re-resolve.
      const res = await submitClaim({ order_code: preview.orderCode })
      if (!res.ok) {
        reportError(res.error)
        // Server is authoritative — a claimed order can never be claimed again.
        if (res.code === "already_claimed") setPreview(null)
        return
      }
      setResult(res.result)
    })
  }

  if (result) return <Done result={result} onRestart={reset} />

  const bonusPoints = preview ? preview.previewPoints - preview.basePoints : 0
  const multiplier =
    preview && preview.basePoints > 0
      ? (preview.previewPoints / preview.basePoints).toFixed(1)
      : "1.0"

  return (
    <div className="bg-card border-border rounded-xl border p-6 md:p-12">
      <h2 className="text-headline-md mb-6 text-center md:text-left">
        {c.order.title}
      </h2>

      <Form {...lookupForm}>
        <form
          onSubmit={lookupForm.handleSubmit(handleCheck)}
          className="grid gap-6"
        >
          <FormField
            control={lookupForm.control}
            name="order_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{c.order.orderLabel}</FormLabel>
                <FormControl>
                  <Input
                    icon={Receipt}
                    placeholder={c.order.placeholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!preview && <FormError message={error} />}

          <Button type="submit" size="xl" disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : null}
            {isPending ? c.order.checking : c.order.continue}
            {!isPending && <Search className="size-5" aria-hidden />}
          </Button>
        </form>
      </Form>

      <Collapsible className="group border-border mt-6 rounded-lg border px-4 py-3">
        <CollapsibleTrigger className="text-body-sm focus-visible:ring-primary/30 flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm font-semibold outline-none focus-visible:ring-2">
          {c.order.hintToggle}
          <ChevronDown
            className="text-muted-foreground size-4 transition-transform group-data-open:rotate-180"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="text-body-sm text-muted-foreground mt-2">
          {c.order.hintBody}
        </CollapsibleContent>
      </Collapsible>

      {preview && (
        <div className="border-border mt-12 border-t pt-12">
          <div className="bg-surface-container border-secondary-container/30 rounded-xl border p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-label-md text-muted-foreground uppercase">
                  {c.summary.heading}
                </p>
                <h3 className="text-headline-md text-secondary">
                  {c.summary.orderLabel(preview.displayCode)}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-label-md text-muted-foreground uppercase">
                  {c.summary.itemsLabel(preview.items.length)}
                </p>
              </div>
            </div>

            <div className="mb-12 grid gap-4">
              <Row
                label={c.summary.totalLabel}
                value={preview.total.toLocaleString()}
              />
              <Row
                icon={PlusCircle}
                label={c.summary.basePoints}
                value={`+${preview.basePoints.toLocaleString()}`}
                accent
              />
              {bonusPoints > 0 && (
                <Row
                  icon={Zap}
                  label={c.summary.tierBonus(multiplier)}
                  value={`+${bonusPoints.toLocaleString()}`}
                  accent
                />
              )}
            </div>

            <div className="bg-accent text-accent-foreground flex items-center justify-between rounded-lg p-6">
              <div>
                <p className="text-label-md tracking-widest uppercase opacity-80">
                  {c.summary.totalPoints}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-headline-lg tabular-nums">
                    {preview.previewPoints.toLocaleString()}
                  </span>
                  <span className="text-label-md uppercase">
                    {c.summary.pointsUnit}
                  </span>
                </div>
              </div>
              <BadgePercent className="size-12 opacity-40" aria-hidden />
            </div>

            <ItemBreakdown items={preview.items} />
            <TierProgress preview={preview} />
          </div>

          <div className="mt-6 grid gap-6">
            <FormError message={error} />

            <Button
              type="button"
              variant="accent"
              size="xl"
              disabled={isPending}
              onClick={handleClaim}
            >
              {isPending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : null}
              {isPending ? c.summary.confirming : c.summary.confirm}
              {!isPending && <ArrowRight className="size-5" aria-hidden />}
            </Button>
            <p className="text-label-md text-muted-foreground text-center">
              {c.summary.terms}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon?: typeof PlusCircle
  accent?: boolean
}) {
  return (
    <div
      className={`text-body-lg flex justify-between ${accent ? "text-primary" : ""}`}
    >
      <span
        className={`flex items-center gap-1 ${accent ? "" : "text-muted-foreground"}`}
      >
        {Icon && <Icon className="size-[18px]" aria-hidden />}
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  )
}

function ItemBreakdown({ items }: { items: OrderItemView[] }) {
  const s = useT().claim.summary
  if (items.length === 0) return null
  return (
    <Collapsible className="group border-border/60 mt-6 border-t pt-4">
      <CollapsibleTrigger className="text-label-md text-muted-foreground focus-visible:ring-primary/30 flex w-full cursor-pointer items-center justify-between rounded-sm uppercase outline-none focus-visible:ring-2">
        {s.itemsToggle}
        <ChevronDown
          className="size-4 transition-transform group-data-open:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 grid gap-2" render={<ul />}>
        {items.map((item, i) => (
          <li
            key={`${item.sku ?? "na"}-${i}`}
            className="text-body-sm flex items-start justify-between gap-2"
          >
            <span className="flex min-w-0 items-start gap-1.5">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                {s.quantity(item.quantity)}
              </Badge>
              <span className="line-clamp-2">{item.name}</span>
            </span>
            {item.points > 0 ? (
              <Badge variant="success" className="shrink-0">
                {s.itemPoints(item.points)}
              </Badge>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge variant="muted" className="shrink-0" tabIndex={0} />
                  }
                >
                  {s.unmapped}
                </TooltipTrigger>
                <TooltipContent>{s.unmappedHint}</TooltipContent>
              </Tooltip>
            )}
          </li>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function TierProgress({ preview }: { preview: Preview }) {
  const p = useT().claim.progress
  return (
    <div className="border-border/60 mt-6 grid gap-2 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={preview.tierName ? "default" : "muted"}>
          {preview.tierName ? p.tier(preview.tierName) : p.noTier}
        </Badge>
        <span className="text-body-sm text-muted-foreground">
          {p.balance(preview.currentPoints)}
        </span>
      </div>
      <Progress value={preview.tierProgress} label={p.tierProgressLabel} />
      <div className="text-muted-foreground text-body-xs flex items-center justify-between gap-2">
        <span>{p.currentTierLabel}</span>
        {preview.nextTierName && <span>{preview.nextTierName}</span>}
      </div>
      <p className="text-body-sm text-muted-foreground">
        {preview.nextTierName && preview.pointsToNextTier !== null
          ? p.toNextTier(preview.pointsToNextTier, preview.nextTierName)
          : p.topTier}
      </p>
      {preview.nextRewardName && preview.pointsToNextReward !== null && (
        <p className="text-body-sm text-muted-foreground flex items-center gap-1.5">
          <Gift className="size-3.5 shrink-0" aria-hidden />
          {preview.pointsToNextReward > 0
            ? p.toNextReward(preview.pointsToNextReward, preview.nextRewardName)
            : p.rewardReady(preview.nextRewardName)}
        </p>
      )}
    </div>
  )
}

function Done({
  result,
  onRestart,
}: {
  result: ClaimResult
  onRestart: () => void
}) {
  const d = useT().claim.done
  return (
    <div className="bg-card border-border grid gap-6 rounded-xl border p-6 md:p-12">
      <div className="grid justify-items-center gap-2 text-center">
        <span className="bg-accent text-primary grid size-14 place-items-center rounded-full">
          <PartyPopper className="size-7" aria-hidden />
        </span>
        <h2 className="text-headline-md">{d.title}</h2>
        <p className="text-body-sm text-muted-foreground">{d.description}</p>
      </div>

      <div className="bg-accent text-accent-foreground grid justify-items-center gap-1 rounded-lg p-6">
        <p className="text-headline-lg tabular-nums">
          {d.awarded(result.points_awarded)}
        </p>
        <p className="text-label-md uppercase opacity-80">{d.awardedLabel}</p>
      </div>

      <p className="text-body-sm text-center">
        {d.balance(result.current_points)}
      </p>

      {result.tier_upgraded && result.tier_name && (
        <p className="text-body-sm flex items-center justify-center gap-1.5 font-semibold">
          <Trophy className="text-warning size-4" aria-hidden />
          {d.tierUpgraded(result.tier_name)}
        </p>
      )}

      <div className="bg-surface-container border-border grid gap-1 rounded-lg border p-4">
        <p className="text-body-sm font-semibold">{d.whatNextTitle}</p>
        <p className="text-body-sm text-muted-foreground">{d.whatNextBody}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/rewards" className={buttonVariants({ size: "sm" })}>
            {d.rewardsCta}
          </Link>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {d.dashboardCta}
          </Link>
        </div>
      </div>

      <Button type="button" variant="secondary" size="xl" onClick={onRestart}>
        {d.claimAnother}
      </Button>
    </div>
  )
}
