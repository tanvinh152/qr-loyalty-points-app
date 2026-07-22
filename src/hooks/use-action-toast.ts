"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

type ActionState = { ok: boolean; message: string } | null

/**
 * Toasts the result of a `useActionState` server action exactly once per
 * result. React can re-run the effect with the same state object, so the last
 * state is held in a ref rather than compared by value — two identical failures
 * in a row are distinct objects and both deserve a toast.
 */
export function useActionToast(state: ActionState) {
  const last = useRef<ActionState>(null)

  useEffect(() => {
    if (!state || state === last.current) return
    last.current = state
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])
}
