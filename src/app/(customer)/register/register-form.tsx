"use client"

import { useActionState } from "react"
import { ArrowRight, Lock, Receipt, Smartphone } from "lucide-react"

import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import { signUp, type AuthState } from "../auth/actions"

export function RegisterForm({ requireProof }: { requireProof: boolean }) {
  const t = useT()
  const r = t.customer.register
  const l = t.customer.login
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signUp,
    null,
  )

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
          className="rounded-full"
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">{l.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          icon={Lock}
          placeholder={l.passwordPlaceholder}
          autoComplete="new-password"
          className="rounded-full"
          minLength={8}
          required
        />
      </div>

      {requireProof && (
        <div className="grid gap-2">
          <Label htmlFor="order_code">{r.orderCode}</Label>
          <Input
            id="order_code"
            name="order_code"
            icon={Receipt}
            placeholder={r.orderCodePlaceholder}
            className="rounded-full"
            required
          />
          <p className="text-body-sm text-muted-foreground">
            {r.orderCodeHint}
          </p>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Checkbox id="terms" name="terms" required className="mt-1" />
        {/* The policies are not published as routes yet, so they are named in
            plain text rather than styled as links that go nowhere. */}
        {/* Prose, not an overline: undo Label's uppercase flex row so the
            sentence wraps as one block instead of four spaced-out fragments. */}
        <Label
          htmlFor="terms"
          className="text-body-sm block gap-0 px-0 font-normal normal-case"
        >
          {r.terms}
          <span className="font-semibold">{r.termsLink}</span>
          {r.termsAnd}
          <span className="font-semibold">{r.privacyLink}</span>.
        </Label>
      </div>

      <FormError message={state?.error} />

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="rounded-full"
        disabled={isPending}
      >
        {isPending ? r.submitting : r.submit}
        {!isPending && <ArrowRight className="size-5" aria-hidden />}
      </Button>
    </form>
  )
}
