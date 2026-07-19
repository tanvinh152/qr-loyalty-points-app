"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { makeCustomerInfoSchema, type CustomerInfoInput } from "@/lib/schemas"
import { useT } from "@/lib/i18n/provider"
import type { ClaimResult } from "@/lib/db-types"
import {
  lookupOrder,
  submitClaim,
  verifyPhone,
  type OrderItemView,
  type PhoneVerifyResult,
} from "./actions"

type Step = "order" | "phone" | "info" | "done"
type Verified = Extract<PhoneVerifyResult, { ok: true }>

export function ClaimForm() {
  const t = useT()
  const [step, setStep] = useState<Step>("order")
  const [orderInput, setOrderInput] = useState("")
  const [phoneInput, setPhoneInput] = useState("")
  const [orderCode, setOrderCode] = useState("")
  const [displayCode, setDisplayCode] = useState("")
  const [orderTotal, setOrderTotal] = useState(0)
  const [maskedPhone, setMaskedPhone] = useState("")
  const [items, setItems] = useState<OrderItemView[]>([])
  const [previewPoints, setPreviewPoints] = useState(0)
  const [verified, setVerified] = useState<Verified | null>(null)
  const [result, setResult] = useState<ClaimResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const infoForm = useForm<CustomerInfoInput>({
    resolver: zodResolver(makeCustomerInfoSchema(t.validation)),
    defaultValues: { full_name: "", email: "" },
  })

  function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await lookupOrder({ order_code: orderInput })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setOrderCode(res.orderCode)
      setDisplayCode(res.displayCode)
      setOrderTotal(res.total)
      setMaskedPhone(res.maskedPhone)
      setItems(res.items)
      setPreviewPoints(res.previewPoints)
      setStep("phone")
    })
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await verifyPhone({ order_code: orderCode, phone: phoneInput })
      if (!res.ok) {
        toast.error(res.error)
        if (res.code === "already_claimed") setStep("order")
        return
      }
      setVerified(res)
      setPreviewPoints(res.previewPoints)
      infoForm.reset({ full_name: res.fullName ?? "", email: res.email ?? "" })
      setStep("info")
    })
  }

  function handleClaim(values: CustomerInfoInput) {
    startTransition(async () => {
      const res = await submitClaim({
        ...values,
        order_code: orderCode,
        phone: phoneInput,
      })
      if (!res.ok) {
        toast.error(res.error)
        // Server is authoritative — if already claimed, send back to start.
        if (res.code === "already_claimed") setStep("order")
        return
      }
      setResult(res.result)
      setStep("done")
    })
  }

  return (
    <Card className="w-full max-w-md">
      {step === "order" && (
        <>
          <CardHeader>
            <CardTitle>{t.claim.order.title}</CardTitle>
            <CardDescription>{t.claim.order.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLookup} className="grid gap-4">
              <Input
                placeholder={t.claim.order.placeholder}
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                autoFocus
              />
              <Button type="submit" disabled={isPending || !orderInput.trim()}>
                {isPending ? t.claim.order.checking : t.claim.order.continue}
              </Button>
            </form>
          </CardContent>
        </>
      )}

      {step === "phone" && (
        <>
          <CardHeader>
            <CardTitle>{t.claim.phone.title}</CardTitle>
            <CardDescription>{t.claim.phone.description(maskedPhone)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <OrderSummary
              displayCode={displayCode}
              total={orderTotal}
              items={items}
              previewPoints={previewPoints}
            />
            <form onSubmit={handleVerify} className="grid gap-4">
              <Input
                inputMode="tel"
                placeholder={t.claim.phone.placeholder}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                autoFocus
              />
              <Button type="submit" disabled={isPending || !phoneInput.trim()}>
                {isPending ? t.claim.phone.verifying : t.claim.phone.verify}
              </Button>
            </form>
          </CardContent>
        </>
      )}

      {step === "info" && verified && (
        <>
          <CardHeader>
            <CardTitle>{t.claim.info.title(previewPoints)}</CardTitle>
            <CardDescription>
              {t.claim.info.description(displayCode, orderTotal.toLocaleString())}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <TierProgress verified={verified} />
            <Form {...infoForm}>
              <form
                onSubmit={infoForm.handleSubmit(handleClaim)}
                className="grid gap-4"
              >
                <FormField
                  control={infoForm.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.claim.info.fullName}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t.claim.info.fullNamePlaceholder}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={infoForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.claim.info.email}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t.claim.info.emailPlaceholder}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isPending}>
                  {isPending ? t.claim.info.claiming : t.claim.info.claim}
                </Button>
              </form>
            </Form>
          </CardContent>
        </>
      )}

      {step === "done" && result && (
        <>
          <CardHeader>
            <CardTitle>{t.claim.done.title}</CardTitle>
            <CardDescription>{t.claim.done.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-2xl font-semibold">
              {t.claim.done.awarded(result.points_awarded)}
            </p>
            <p className="text-muted-foreground text-sm">
              {t.claim.done.balance(result.current_points)}
            </p>
            {result.tier_upgraded && result.tier_name && (
              <p className="text-sm font-medium">
                {t.claim.done.tierUpgraded(result.tier_name)}
              </p>
            )}
            {/* Redemption lands in Phase 4; no dead link until then. */}
            <p className="text-muted-foreground mt-4 text-sm">
              {t.claim.done.comingSoon}
            </p>
          </CardContent>
        </>
      )}
    </Card>
  )
}

function OrderSummary({
  displayCode,
  total,
  items,
  previewPoints,
}: {
  displayCode: string
  total: number
  items: OrderItemView[]
  previewPoints: number
}) {
  const s = useT().claim.summary
  return (
    <div className="grid gap-2 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between font-medium">
        <span>{s.orderLabel(displayCode)}</span>
        <span>{total.toLocaleString()}</span>
      </div>
      <ul className="grid gap-1">
        {items.map((item, i) => (
          <li key={`${item.sku ?? "na"}-${i}`} className="flex justify-between gap-2">
            <span className="text-muted-foreground line-clamp-2">
              {item.name} {s.quantity(item.quantity)}
            </span>
            <span className="shrink-0">
              {item.points > 0 ? s.itemPoints(item.points) : s.unmapped}
            </span>
          </li>
        ))}
      </ul>
      <p className="font-semibold">{s.estimated(previewPoints)}</p>
    </div>
  )
}

function TierProgress({ verified }: { verified: Verified }) {
  const p = useT().claim.progress
  return (
    <div className="grid gap-2 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {verified.tierName ? p.tier(verified.tierName) : p.noTier}
        </span>
        <span className="text-muted-foreground">
          {p.balance(verified.currentPoints)}
        </span>
      </div>
      <Progress value={verified.tierProgress} />
      <p className="text-muted-foreground">
        {verified.nextTierName && verified.pointsToNextTier !== null
          ? p.toNextTier(verified.pointsToNextTier, verified.nextTierName)
          : p.topTier}
      </p>
      {verified.nextRewardName && verified.pointsToNextReward !== null && (
        <p className="text-muted-foreground">
          {verified.pointsToNextReward > 0
            ? p.toNextReward(verified.pointsToNextReward, verified.nextRewardName)
            : p.rewardReady(verified.nextRewardName)}
        </p>
      )}
    </div>
  )
}
