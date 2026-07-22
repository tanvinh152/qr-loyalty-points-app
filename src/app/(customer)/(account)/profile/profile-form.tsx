"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  ArrowRight,
  Cake,
  Cat,
  Dog,
  PawPrint,
  Receipt,
  Sparkles,
  UserRound,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/provider"
import type { CustomerRow, PetType } from "@/lib/db-types"
import { saveProfile } from "./actions"

const PET_TYPES: { value: PetType; icon: LucideIcon }[] = [
  { value: "dog", icon: Dog },
  { value: "cat", icon: Cat },
  { value: "other", icon: PawPrint },
]

// The mockup's fields are taller, rounder pills than the shared Input default.
const FIELD = "h-14 rounded-2xl"

export function ProfileForm({ customer }: { customer: CustomerRow }) {
  const t = useT()
  const p = t.customer.profile
  const router = useRouter()
  const [petType, setPetType] = useState<PetType | undefined>(
    customer.pet_type ?? undefined,
  )
  const [orderCode, setOrderCode] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  // The callout hands the code to /claim rather than claiming here: claim_points
  // stays the single write path and the phone gate is not duplicated.
  function goToClaim() {
    const code = orderCode.trim()
    router.push(code ? `/claim?code=${encodeURIComponent(code)}` : "/claim")
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await saveProfile({
        ...Object.fromEntries(formData.entries()),
        // The pet-type toggle is buttons, not a field, so it is merged in here.
        pet_type: petType,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setError(undefined)
      toast.success(p.success)
    })
  }

  return (
    <form action={handleSubmit} className="grid gap-8">
      <fieldset className="grid gap-4">
        <legend className="text-headline-md mb-2 flex items-center gap-2">
          <UserRound className="text-primary size-5" aria-hidden />
          {p.ownerSection}
        </legend>
        <div className="grid gap-2">
          <Label htmlFor="full_name">{p.fullName}</Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={customer.full_name ?? ""}
            placeholder={p.fullNamePlaceholder}
            autoComplete="name"
            icon={UserRound}
            className={FIELD}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="date_of_birth">{p.dob}</Label>
          <Input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            defaultValue={customer.date_of_birth ?? ""}
            icon={Cake}
            className={FIELD}
          />
        </div>
      </fieldset>

      <span aria-hidden className="bg-border/30 h-px w-full" />

      <fieldset className="grid gap-4">
        <legend className="text-headline-md mb-2 flex items-center gap-2">
          <PawPrint className="text-primary size-5" aria-hidden />
          {p.petSection}
        </legend>
        <div className="grid gap-2">
          <Label htmlFor="pet_name">{p.petName}</Label>
          <Input
            id="pet_name"
            name="pet_name"
            defaultValue={customer.pet_name ?? ""}
            placeholder={p.petNamePlaceholder}
            icon={PawPrint}
            className={FIELD}
          />
        </div>

        <div className="grid gap-2">
          <span className="text-body-sm font-medium">{p.petType}</span>
          <div
            role="group"
            aria-label={p.petType}
            className="grid grid-cols-3 gap-3"
          >
            {PET_TYPES.map(({ value, icon: Icon }) => {
              const active = petType === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPetType(active ? undefined : value)}
                  className={cn(
                    "border-border grid justify-items-center gap-1.5 rounded-2xl border p-4 transition-colors",
                    active
                      ? "border-primary-container bg-primary-container/15 text-primary"
                      : "bg-surface-container text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="text-body-sm">{p.petTypes[value]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="pet_dob">{p.petDob}</Label>
          <Input
            id="pet_dob"
            name="pet_dob"
            type="date"
            defaultValue={customer.pet_dob ?? ""}
            icon={Cake}
            className={FIELD}
          />
          <p className="text-body-xs text-muted-foreground">{p.petDobHint}</p>
        </div>

        {/* The mockup puts the order-code callout here, right under the pet
            fields, as the profile's one outbound action. */}
        <section className="border-primary-container bg-primary-container/10 grid gap-3 rounded-3xl border-2 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-5 shrink-0" aria-hidden />
            <span className="text-body-lg font-semibold">{p.orderSection}</span>
          </div>
          <div className="grid gap-3">
            <div>
              {/* Deliberately unnamed: this must never ride along in the profile
                  payload that `saveProfile` parses. */}
              <Input
                id="order_code"
                aria-label={p.orderPlaceholder}
                placeholder={p.orderPlaceholder}
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                // The block sits inside the profile <form>, so Enter would
                // submit the profile. It goes to /claim instead.
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return
                  e.preventDefault()
                  goToClaim()
                }}
                icon={Receipt}
                className={cn(
                  FIELD,
                  "border-primary-container/60 font-semibold",
                )}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xl"
              onClick={goToClaim}
            >
              {p.orderCta}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
          <p className="text-body-sm text-muted-foreground italic">
            {p.orderHint}
          </p>
        </section>
      </fieldset>

      <FormError message={error} />

      <Button type="submit" size="xl" className="w-full" disabled={isPending}>
        {isPending ? (
          p.submitting
        ) : (
          <>
            {p.submit}
            <ArrowRight className="size-5" aria-hidden />
          </>
        )}
      </Button>
    </form>
  )
}
