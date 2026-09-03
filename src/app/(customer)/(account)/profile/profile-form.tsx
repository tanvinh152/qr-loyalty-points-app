"use client"

import { useState, useTransition } from "react"
import {
  ArrowRight,
  Cake,
  Cat,
  Dog,
  PawPrint,
  Sparkles,
  UserRound,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { FormError } from "@/components/form-error"
import { PendingIcon } from "@/components/pending-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import type { CustomerRow, PetType } from "@/lib/db-types"
import { saveProfile } from "./actions"

const PET_TYPES: { value: PetType; icon: LucideIcon }[] = [
  { value: "dog", icon: Dog },
  { value: "cat", icon: Cat },
  { value: "other", icon: PawPrint },
]

// The mockup's fields are taller, rounder pills than the shared Input default.
const FIELD = "h-12 rounded-full"

export function ProfileForm({ customer }: { customer: CustomerRow }) {
  const t = useT()
  const p = t.customer.profile
  const [error, setError] = useState<string | undefined>()
  // Once the profile is complete the button is "Save", and a save with nothing
  // changed is a no-op the member should not have to wonder about. The first
  // completion stays always-on: the pet fields are optional, so an untouched
  // form is still a valid first submission.
  const [dirty, setDirty] = useState(false)
  const completed = Boolean(customer.profile_completed_at)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      // pet_type arrives with the rest: the toggle is a real radio group now.
      const res = await saveProfile(Object.fromEntries(formData.entries()))
      if (!res.ok) {
        setError(res.error)
        return
      }
      setError(undefined)
      setDirty(false)
      toast.success(p.success)
    })
  }

  return (
    <form
      action={handleSubmit}
      onChange={() => setDirty(true)}
      className="grid gap-8"
    >
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

      <span aria-hidden className="bg-border/60 h-px w-full" />

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

        {/* A real radio group — arrow keys move between the three, the value
            posts as `pet_type` with no JS, and the tile styles itself off its
            own input with `has-checked:`. It was three `aria-pressed` buttons
            with the value merged in by hand. The one thing lost is deselect:
            a radio group cannot go back to "no answer" once one is picked. */}
        <fieldset className="grid gap-2">
          <legend className="text-body-sm mb-2 font-medium">{p.petType}</legend>
          <div className="grid grid-cols-3 gap-3">
            {PET_TYPES.map(({ value, icon: Icon }) => (
              <label
                key={value}
                className="border-border bg-surface-container text-muted-foreground hover:text-foreground has-checked:border-primary-container has-checked:bg-primary-container/15 has-checked:text-primary has-focus-visible:ring-primary/30 duration-instant ease-out-quart grid cursor-pointer justify-items-center gap-1.5 rounded-2xl border p-4 transition-colors has-focus-visible:ring-2"
              >
                <input
                  type="radio"
                  name="pet_type"
                  value={value}
                  defaultChecked={customer.pet_type === value}
                  className="sr-only"
                />
                <Icon className="size-5" aria-hidden />
                <span className="text-body-sm">{p.petTypes[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

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

        {/* The mockup's order-code callout used to hand a code to /claim. There
            is no manual claim any more — points land by webhook — so the slot
            keeps only the reassurance. */}
        <section className="border-primary-container bg-primary-container/10 grid gap-2 rounded-3xl border-2 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-5 shrink-0" aria-hidden />
            <span className="text-body-lg font-semibold">{p.orderSection}</span>
          </div>
          <p className="text-body-sm text-muted-foreground">{p.orderHint}</p>
        </section>
      </fieldset>

      <FormError message={error} />

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={isPending || (completed && !dirty)}
      >
        {/* Matches the heading: "complete" the first time, "save" after. */}
        {isPending
          ? p.submitting
          : customer.profile_completed_at
            ? p.submitEdit
            : p.submit}
        <PendingIcon pending={isPending} className="size-5">
          <ArrowRight className="size-5" aria-hidden />
        </PendingIcon>
      </Button>
    </form>
  )
}
