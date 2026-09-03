"use client"

import { useEffect } from "react"

/**
 * Field-level validation for the forms that post through `useActionState`
 * and a plain `action={formAction}` — the auth screens, which must keep
 * working with no JS and so cannot become react-hook-form fields.
 *
 * The server already validates with zod and now says WHICH field failed
 * (`AuthState.field`). These three pieces turn that into what a member sees:
 * the field outlined in red (`aria-invalid` — `ui/input` styles it), the
 * reason printed under it, and focus moved there. Field ids equal field names
 * in every consumer, which is what lets `useFocusInvalid` find the input.
 */
type FieldState = { error: string; field?: string } | null

/** The message for `name`, or nothing when the failure is not field-level. */
export function fieldError(state: FieldState, name: string) {
  return state?.field === name ? state.error : undefined
}

/** Spread onto the input: marks it invalid and points at its message. */
export function invalidProps(id: string, message: string | undefined) {
  if (!message) return {}
  return { "aria-invalid": true as const, "aria-describedby": `${id}-error` }
}

export function FieldError({
  id,
  message,
}: {
  /** The field's id — the message renders as `${id}-error`. */
  id: string
  message: string | undefined
}) {
  if (!message) return null
  return (
    <p id={`${id}-error`} className="text-body-sm text-destructive">
      {message}
    </p>
  )
}

/** Moves focus to the failed field when a new state names one. Keyed on the
 *  state object, not the field name, so a repeat failure on the same field
 *  refocuses — `useActionState` hands back a fresh object per submission. */
export function useFocusInvalid(state: FieldState) {
  useEffect(() => {
    if (!state?.field) return
    const input = document.getElementById(state.field)
    if (input instanceof HTMLElement) input.focus()
  }, [state])
}
