"use client"

import { useRef, useState, useTransition } from "react"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import { Send } from "@/components/animate-ui/icons/send"
import { toast } from "sonner"

import { FormError } from "@/components/form-error"
import { PendingIcon } from "@/components/pending-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n/provider"
import { SUPPORT_TOPICS } from "@/lib/schemas"
import { submitSupportRequest } from "./actions"

const MESSAGE_MAX = 2000

export function HelpForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string
  defaultEmail: string
}) {
  const t = useT()
  const h = t.customer.help
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | undefined>()
  const [used, setUsed] = useState(0)
  // `form.reset()` clears the native fields but not a Radix Select's own
  // state; re-keying it is the reliable way to put the placeholder back.
  const [formKey, setFormKey] = useState(0)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await submitSupportRequest(
        Object.fromEntries(formData.entries()),
      )
      if (!res.ok) {
        setError(res.error)
        return
      }
      setError(undefined)
      formRef.current?.reset()
      setUsed(0)
      setFormKey((k) => k + 1)
      toast.success(h.success)
    })
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="grid gap-4 p-4 sm:gap-6 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <div className="grid gap-2">
          <Label htmlFor="support-name">{h.name}</Label>
          <Input
            id="support-name"
            name="name"
            defaultValue={defaultName}
            placeholder={h.namePlaceholder}
            autoComplete="name"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="support-email">{h.email}</Label>
          <Input
            id="support-email"
            name="email"
            type="email"
            defaultValue={defaultEmail}
            placeholder={h.emailPlaceholder}
            autoComplete="email"
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="support-topic">{h.topic}</Label>
        {/* The design-system Select IS a form control now: Radix renders a
            hidden native <select> under `name` inside a form, so the value
            reaches the FormData action like any other field. The placeholder
            is `SelectValue`'s — an item may never carry `value=""`. */}
        <Select key={formKey} name="topic" required>
          <SelectTrigger id="support-topic" className="h-12 w-full">
            <SelectValue placeholder={h.topicPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {SUPPORT_TOPICS.map((topic) => (
              <SelectItem key={topic} value={topic}>
                {h.topics[topic]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="support-message">{h.message}</Label>
        <Textarea
          id="support-message"
          name="message"
          rows={6}
          maxLength={MESSAGE_MAX}
          placeholder={h.messagePlaceholder}
          onChange={(event) => setUsed(event.target.value.length)}
          aria-describedby="support-message-count"
          required
        />
        {/* Polite, so a screen reader hears the count settle rather than
            every keystroke. */}
        <p
          id="support-message-count"
          aria-live="polite"
          className="text-body-xs text-muted-foreground text-right tabular-nums"
        >
          {h.charCount(used, MESSAGE_MAX)}
        </p>
      </div>

      <FormError message={error} />

      <AnimateIcon animateOnHover asChild>
        <Button
          type="submit"
          size="lg"
          className="w-full md:w-fit"
          disabled={isPending}
        >
          {/* The Send glyph is still an AnimateIcon child: hover is read on
              the Button and reaches it through context, PendingIcon or not. */}
          <PendingIcon pending={isPending} className="size-4">
            <Send className="size-4" aria-hidden />
          </PendingIcon>
          {isPending ? h.submitting : h.submit}
        </Button>
      </AnimateIcon>
    </form>
  )
}
