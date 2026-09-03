"use client"

import Link from "next/link"
import { useActionState } from "react"
import {
  ArrowRight,
  Cake,
  Mail,
  Receipt,
  Smartphone,
  UserRound,
} from "lucide-react"

import {
  FieldError,
  fieldError,
  invalidProps,
  useFocusInvalid,
} from "@/components/field-error"
import { FormError } from "@/components/form-error"
import { PasswordInput } from "@/components/password-input"
import { PendingIcon } from "@/components/pending-icon"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import { signUp, type AuthState } from "../auth/actions"

export function RegisterForm() {
  const t = useT()
  const r = t.customer.register
  const l = t.customer.login
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signUp,
    null,
  )
  useFocusInvalid(state)
  // Field ids equal field names, which is what lets the server's `field`
  // land on the right input and what useFocusInvalid relies on.
  const errorFor = (name: string) => fieldError(state, name)

  return (
    <form action={formAction} className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="full_name">{r.fullName}</Label>
        <Input
          id="full_name"
          name="full_name"
          icon={UserRound}
          placeholder={r.fullNamePlaceholder}
          autoComplete="name"
          required
          {...invalidProps("full_name", errorFor("full_name"))}
        />
        <FieldError id="full_name" message={errorFor("full_name")} />
      </div>

      {/* The account's auth identity, and the only address support can answer
          on — see signUp(). */}
      <div className="grid gap-2">
        <Label htmlFor="email">{r.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          icon={Mail}
          placeholder={r.emailPlaceholder}
          autoComplete="email"
          required
          {...invalidProps("email", errorFor("email"))}
        />
        <FieldError id="email" message={errorFor("email")} />
        <p className="text-body-sm text-muted-foreground">{r.emailHint}</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="date_of_birth">{r.dob}</Label>
        <Input
          id="date_of_birth"
          name="date_of_birth"
          type="date"
          icon={Cake}
          autoComplete="bday"
          required
          {...invalidProps("date_of_birth", errorFor("date_of_birth"))}
        />
        <FieldError id="date_of_birth" message={errorFor("date_of_birth")} />
        <p className="text-body-sm text-muted-foreground">{r.dobHint}</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="phone">{l.phone}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          icon={Smartphone}
          placeholder={l.phonePlaceholder}
          autoComplete="username"
          required
          {...invalidProps("phone", errorFor("phone"))}
        />
        <FieldError id="phone" message={errorFor("phone")} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">{l.password}</Label>
        <PasswordInput
          id="password"
          name="password"
          placeholder={l.passwordPlaceholder}
          autoComplete="new-password"
          showLabel={l.showPassword}
          hideLabel={l.hidePassword}
          minLength={8}
          required
          {...invalidProps("password", errorFor("password"))}
        />
        <FieldError id="password" message={errorFor("password")} />
      </div>

      {/* Both the ownership proof and the Pancake link — see signUp(). */}
      <div className="grid gap-2">
        <Label htmlFor="order_code">{r.orderCode}</Label>
        <Input
          id="order_code"
          name="order_code"
          icon={Receipt}
          placeholder={r.orderCodePlaceholder}
          required
          {...invalidProps("order_code", errorFor("order_code"))}
        />
        <FieldError id="order_code" message={errorFor("order_code")} />
        <p className="text-body-sm text-muted-foreground">{r.orderCodeHint}</p>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="terms"
          name="terms"
          required
          className="mt-1"
          {...invalidProps("terms", errorFor("terms"))}
        />
        {/* Prose, not an overline: undo Label's uppercase flex row so the
            sentence wraps as one block instead of four spaced-out fragments.
            Both links are real routes now — /terms carries the privacy section
            as an anchor rather than a separate page, so neither leads nowhere. */}
        <Label
          htmlFor="terms"
          className="text-body-sm block gap-0 px-0 font-normal normal-case"
        >
          {r.terms}
          <Link href="/terms" className="text-primary font-semibold underline">
            {r.termsLink}
          </Link>
          {r.termsAnd}
          <Link
            href="/terms#privacy"
            className="text-primary font-semibold underline"
          >
            {r.privacyLink}
          </Link>
          .
        </Label>
      </div>
      <FieldError id="terms" message={errorFor("terms")} />

      {/* A field-level failure is printed under its field; the banner is for
          everything about the submission as a whole. */}
      <FormError message={state?.field ? undefined : state?.error} />

      <Button type="submit" variant="brand" size="xl" disabled={isPending}>
        {isPending ? r.submitting : r.submit}
        <PendingIcon pending={isPending} className="size-5">
          <ArrowRight className="size-5" aria-hidden />
        </PendingIcon>
      </Button>
    </form>
  )
}
