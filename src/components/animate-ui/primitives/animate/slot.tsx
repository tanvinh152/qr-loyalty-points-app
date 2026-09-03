"use client"

import * as React from "react"
import { m, isMotionComponent, type HTMLMotionProps } from "motion/react"
import { cn } from "@/lib/utils"

type AnyProps = Record<string, unknown>

type DOMMotionProps<T extends HTMLElement = HTMLElement> = Omit<
  HTMLMotionProps<keyof HTMLElementTagNameMap>,
  "ref"
> & { ref?: React.Ref<T> }

type WithAsChild<Base extends object> =
  | (Base & { asChild: true; children: React.ReactElement })
  | (Base & { asChild?: false | undefined })

type SlotProps<T extends HTMLElement = HTMLElement> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children?: any
} & DOMMotionProps<T>

function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return
      if (typeof ref === "function") {
        ref(node)
      } else {
        ;(ref as React.RefObject<T | null>).current = node
      }
    })
  }
}

function mergeProps<T extends HTMLElement>(
  childProps: AnyProps,
  slotProps: DOMMotionProps<T>,
): AnyProps {
  const merged: AnyProps = { ...childProps, ...slotProps }

  if (childProps.className || slotProps.className) {
    merged.className = cn(
      childProps.className as string,
      slotProps.className as string,
    )
  }

  if (childProps.style || slotProps.style) {
    merged.style = {
      ...(childProps.style as React.CSSProperties),
      ...(slotProps.style as React.CSSProperties),
    }
  }

  return merged
}

// `m.create()` must NOT run during render: every call mints a BRAND NEW
// component type, and a new type resets the whole subtree's state. Upstream
// wraps it in `useMemo`, which is per-instance and still creates one wrapper
// per mount. A module-level cache keyed on the child's element type makes the
// wrapper identity stable for the lifetime of the page, which is what React
// actually wants — and it lets the `isValidElement` guard move to the top,
// where it belongs (upstream reads `children.type` two statements before
// checking that `children` is an element at all).
const motionCache = new Map<React.ElementType, React.ElementType>()

function getMotionComponent(type: React.ElementType): React.ElementType {
  if (typeof type === "object" && type !== null && isMotionComponent(type)) {
    return type
  }

  let cached = motionCache.get(type)
  if (!cached) {
    cached = m.create(type)
    motionCache.set(type, cached)
  }
  return cached
}

function Slot<T extends HTMLElement = HTMLElement>({
  children,
  ref,
  ...props
}: SlotProps<T>) {
  // NOT `return null`, which is what upstream does. A server component's JSX
  // arrives here as a Flight LAZY CHUNK, not an element: React outlines a large
  // enough prop into its own chunk and hands the client a
  // `Symbol(react.lazy)` wrapper, which `isValidElement` rejects. The SSR pass
  // reads it before that chunk resolves, so bailing to null renders NOTHING on
  // the server while the browser — which has the resolved element — renders the
  // real one, and the page dies on a hydration mismatch. Whether a given call
  // site trips it is a SIZE heuristic (`ui/input.tsx`'s long class string does,
  // `page-link.tsx`'s does not), so it is not something a call site can be
  // trusted to avoid.
  //
  // Rendering `children` untouched is a faithful fallback: the only props a
  // Slot merges are the handlers and ref, which produce no HTML, so the markup
  // is byte-identical to what the motion wrapper emits and hydration matches.
  // The wrapper is simply inert for that one server pass — the client re-renders
  // it as a motion component, and every animation this Slot drives is
  // interaction-driven and needs JS anyway.
  if (!React.isValidElement(children)) return <>{children}</>

  const Base = getMotionComponent(children.type as React.ElementType)
  const { ref: childRef, ...childProps } = children.props as AnyProps
  const mergedProps = mergeProps(childProps, props)
  const mergedRef = mergeRefs(childRef as React.Ref<T>, ref)

  // `Base` is NOT created here — getMotionComponent() returns a module-level
  // cached component keyed on the child's element type, so its identity is
  // stable across renders and across instances. The rule cannot see through
  // the cache, and a Slot must by definition wrap whatever element it is
  // handed, so there is no static declaration to hoist to.
  // eslint-disable-next-line react-hooks/static-components
  return <Base {...mergedProps} ref={mergedRef} />
}

export {
  Slot,
  type SlotProps,
  type WithAsChild,
  type DOMMotionProps,
  type AnyProps,
}
