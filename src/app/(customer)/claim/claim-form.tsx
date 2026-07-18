"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { customerInfoSchema, type CustomerInfoInput } from "@/lib/schemas"
import type { ClaimResult } from "@/lib/db-types"
import { validateOrder, submitClaim } from "./actions"

type Step = "order" | "info" | "done"

export function ClaimForm() {
  const [step, setStep] = useState<Step>("order")
  const [orderCode, setOrderCode] = useState("")
  const [orderTotal, setOrderTotal] = useState(0)
  const [previewPoints, setPreviewPoints] = useState(0)
  const [result, setResult] = useState<ClaimResult | null>(null)
  const [orderInput, setOrderInput] = useState("")
  const [isPending, startTransition] = useTransition()

  const infoForm = useForm<CustomerInfoInput>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: { full_name: "", email: "", phone: "" },
  })

  function handleValidate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await validateOrder({ order_code: orderInput })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setOrderCode(res.orderCode)
      setOrderTotal(res.total)
      setPreviewPoints(res.previewPoints)
      setStep("info")
    })
  }

  function handleClaim(values: CustomerInfoInput) {
    startTransition(async () => {
      const res = await submitClaim({ ...values, order_code: orderCode })
      if (!res.ok) {
        toast.error(res.error)
        // Server is authoritative — if already claimed, send back to start.
        if (res.error.includes("already been claimed")) setStep("order")
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
            <CardTitle>Claim your points</CardTitle>
            <CardDescription>Enter your order code to begin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleValidate} className="grid gap-4">
              <Input
                placeholder="e.g. ORD-1001"
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                autoFocus
              />
              <Button type="submit" disabled={isPending || !orderInput.trim()}>
                {isPending ? "Checking…" : "Continue"}
              </Button>
            </form>
          </CardContent>
        </>
      )}

      {step === "info" && (
        <>
          <CardHeader>
            <CardTitle>You&apos;ll earn {previewPoints} points</CardTitle>
            <CardDescription>
              Order {orderCode} · {orderTotal.toLocaleString()}. Enter your details
              to claim.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={infoForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="0912345678" {...field} />
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
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="jane@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Claiming…" : "Claim points"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </>
      )}

      {step === "done" && result && (
        <>
          <CardHeader>
            <CardTitle>Points claimed 🎉</CardTitle>
            <CardDescription>Thanks for your order.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-2xl font-semibold">
              +{result.points_awarded} points
            </p>
            <p className="text-muted-foreground text-sm">
              Your total balance is now {result.total_points} points.
            </p>
          </CardContent>
        </>
      )}
    </Card>
  )
}
