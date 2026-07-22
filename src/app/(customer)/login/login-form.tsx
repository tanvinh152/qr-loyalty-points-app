"use client"

import { useActionState, useState } from "react"
import { ArrowRight, Eye, EyeOff, Lock, Smartphone } from "lucide-react"

import { FormError } from "@/components/form-error"
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
  const [showPassword, setShowPassword] = useState(false)

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
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            icon={Lock}
            placeholder={l.passwordPlaceholder}
            autoComplete="current-password"
            className="rounded-full pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? l.hidePassword : l.showPassword}
            aria-pressed={showPassword}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          >
            {showPassword ? (
              <EyeOff className="size-[18px]" aria-hidden />
            ) : (
              <Eye className="size-[18px]" aria-hidden />
            )}
          </button>
        </div>
        {/* No self-serve reset yet, so this explains where to go instead. A
            Tooltip keeps it reachable by keyboard and on touch, which the old
            `title` attribute was not. */}
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button type="button" variant="link" size="xs">
                  {l.forgot}
                </Button>
              }
            />
            <TooltipContent>{l.forgotHint}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <FormError message={state?.error} />

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="rounded-full"
        disabled={isPending}
      >
        {isPending ? l.submitting : l.submit}
        {!isPending && <ArrowRight className="size-5" aria-hidden />}
      </Button>
    </form>
  )
}
