"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import { login, type LoginState } from "./actions"

export function LoginForm() {
  const l = useT().admin.login
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    login,
    null
  )

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">{l.email}</Label>
        <Input id="email" name="email" type="email" required autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">{l.password}</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {state?.error && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? l.signingIn : l.signIn}
      </Button>
    </form>
  )
}
