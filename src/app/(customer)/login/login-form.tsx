"use client"

import { useActionState } from "react"
import { ArrowRight, Smartphone } from "lucide-react"

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import { signIn, type AuthState } from "../auth/actions"

export function LoginForm() {
  const l = useT().customer.login
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signIn,
    null,
  )
  useFocusInvalid(state)
  const phoneError = fieldError(state, "phone")
  const passwordError = fieldError(state, "password")

  return (
    <form action={formAction} className="grid gap-6">
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
          {...invalidProps("phone", phoneError)}
        />
        <FieldError id="phone" message={phoneError} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">{l.password}</Label>
        <PasswordInput
          id="password"
          name="password"
          placeholder={l.passwordPlaceholder}
          autoComplete="current-password"
          showLabel={l.showPassword}
          hideLabel={l.hidePassword}
          required
          {...invalidProps("password", passwordError)}
        />
        <FieldError id="password" message={passwordError} />
        {/* No self-serve reset yet, so this explains where to go instead. A
            Tooltip keeps it reachable by keyboard and on touch, which the old
            `title` attribute was not. */}
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="link" size="xs">
                {l.forgot}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{l.forgotHint}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* A field-level failure is printed under its field; the banner is for
          everything about the submission as a whole. */}
      <FormError message={state?.field ? undefined : state?.error} />

      <Button type="submit" variant="brand" size="xl" disabled={isPending}>
        {isPending ? l.submitting : l.submit}
        <PendingIcon pending={isPending} className="size-5">
          <ArrowRight className="size-5" aria-hidden />
        </PendingIcon>
      </Button>
    </form>
  )
}
