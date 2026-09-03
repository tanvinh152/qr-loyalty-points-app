"use client"

import * as React from "react"

import {
  Accordion as AccordionPrimitive,
  AccordionContent as AccordionContentPrimitive,
  AccordionHeader,
  AccordionItem as AccordionItemPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
} from "@/components/animate-ui/primitives/radix/accordion"
import { T } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

// The /faq disclosure. It replaced a native <details>/<summary>, which cost
// nothing and needed no client boundary — the trade is a height transition, and
// a real `aria-expanded`/`aria-controls` pairing that <summary> never had.
//
// The trigger's "+" rotates off the item's `data-state`, which Radix keeps
// stamping — a transform variant, not a presence one, so unlike the dialog's
// `data-open:animate-*` it survives the move to AnimatePresence.

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive>) {
  return <AccordionPrimitive {...props} />
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionItemPrimitive>) {
  return (
    <AccordionItemPrimitive
      className={cn(
        "border-border bg-card shadow-soft group rounded-3xl border px-5 py-4",
        className,
      )}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionTriggerPrimitive>) {
  return (
    <AccordionHeader className="flex">
      <AccordionTriggerPrimitive
        className={cn(
          "text-body-lg flex w-full cursor-pointer items-center justify-between gap-4 text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <span
          aria-hidden
          // `group-data-[state=open]` in its explicit form, keyed on the ITEM:
          // Radix stamps data-state on the item and the trigger, never on this
          // span, and the `data-open` custom variant from shadcn/tailwind.css
          // has no `group-` counterpart. AccordionItem carries the `group`.
          className="text-primary shrink-0 transition-transform duration-quick ease-out-quart group-data-[state=open]:rotate-45"
        >
          +
        </span>
      </AccordionTriggerPrimitive>
    </AccordionHeader>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionContentPrimitive>) {
  return (
    <AccordionContentPrimitive transition={T.base} {...props}>
      {/* The padding lives inside, not on the animated box: the height tween
          runs on the box itself, so padding on it would be animated away and
          the text would jump at the end of the reveal. */}
      <p className={cn("text-muted-foreground mt-3", className)}>{children}</p>
    </AccordionContentPrimitive>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
