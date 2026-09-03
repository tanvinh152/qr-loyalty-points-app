import * as React from "react"

interface CommonControlledStateProps<T> {
  value?: T
  defaultValue?: T
}

/**
 * Vendored from Animate UI (`@animate-ui/hooks-use-controlled-state`), with the
 * controlled branch rewritten.
 *
 * Upstream mirrors `value` into local state inside a `useEffect`. That is a
 * cascading render (React's own `set-state-in-effect` lint rejects it) and it
 * leaves the hook one render BEHIND its controlled prop, which shows up as a
 * dropdown that closes a frame late. Deriving the value instead needs no effect
 * and no extra render.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useControlledState<T, Rest extends any[] = []>(
  props: CommonControlledStateProps<T> & {
    onChange?: (value: T, ...args: Rest) => void
  },
): readonly [T, (next: T, ...args: Rest) => void] {
  const { value, defaultValue, onChange } = props

  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<T>(defaultValue as T)

  const setState = React.useCallback(
    (next: T, ...args: Rest) => {
      // A controlled owner decides its own next value; writing local state too
      // would only create a second source of truth to drift.
      if (!isControlled) setInternal(next)
      onChange?.(next, ...args)
    },
    [isControlled, onChange],
  )

  return [isControlled ? (value as T) : internal, setState] as const
}
