"use client"

import { useRef, useState, useTransition } from "react"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import { Send } from "@/components/animate-ui/icons/send"
import { toast } from "sonner"

import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n/provider"
import { SUPPORT_TOPICS } from "@/lib/schemas"
import { submitSupportRequest } from "./actions"

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
        {/* A native select, not the Base UI one: this form posts through a
            plain FormData action, and the styled Select is not a form control. */}
        <select
          id="support-topic"
          name="topic"
          defaultValue=""
          required
          // Sized like Input so the three controls share one height and radius.
          className="border-input bg-card text-body-sm ring-offset-background focus-visible:ring-ring h-12 rounded-md border px-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          <option value="" disabled>
            {h.topicPlaceholder}
          </option>
          {SUPPORT_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {h.topics[topic]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="support-message">{h.message}</Label>
        <Textarea
          id="support-message"
          name="message"
          rows={6}
          maxLength={2000}
          placeholder={h.messagePlaceholder}
          required
        />
      </div>

      <FormError message={error} />

      <AnimateIcon animateOnHover asChild>
        <Button
          type="submit"
          size="lg"
          className="w-full md:w-fit"
          disabled={isPending}
        >
          <Send className="size-4" aria-hidden />
          {isPending ? h.submitting : h.submit}
        </Button>
      </AnimateIcon>
    </form>
  )
}
