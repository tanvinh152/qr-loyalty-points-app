"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { FormDialog } from "@/components/form-dialog"
import { FormError } from "@/components/form-error"
import { ImageUpload } from "@/components/image-upload"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  fieldValue,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n/provider"
import {
  makeMilestoneSchema,
  type MilestoneFormValues,
  type MilestoneInput,
} from "@/lib/schemas"
import type { RewardRow } from "@/lib/db-types"
import { saveMilestone } from "./actions"

/** Create/edit dialog for one rung. `trigger` overrides the default button. */
export function MilestoneDialog({
  row,
  trigger,
}: {
  /** A `kind = 'milestone'` reward row; only the ladder columns are read. */
  row?: RewardRow
  trigger?: React.ReactNode
}) {
  const t = useT()
  const m = t.admin.rewards.milestone

  const defaultTrigger = row ? (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={`${t.common.edit} — ${row.name}`}
    >
      <Pencil aria-hidden />
    </Button>
  ) : (
    <Button type="button">
      <Plus aria-hidden />
      {m.addTitle}
    </Button>
  )

  return (
    <FormDialog
      title={row ? `${t.common.edit} — ${row.name}` : m.addTitle}
      description={m.helper}
      trigger={trigger ?? defaultTrigger}
      className="sm:max-w-2xl"
    >
      {(close) => <MilestoneFields row={row} onSaved={close} />}
    </FormDialog>
  )
}

function MilestoneFields({
  row,
  onSaved,
}: {
  row?: RewardRow
  onSaved: () => void
}) {
  const t = useT()
  const m = t.admin.rewards.milestone
  const [isPending, startTransition] = useTransition()

  const form = useForm<MilestoneFormValues, unknown, MilestoneInput>({
    resolver: zodResolver(makeMilestoneSchema(t.validation)),
    defaultValues: {
      id: row?.id,
      name: row?.name ?? "",
      description: row?.description ?? "",
      image_url: row?.image_url ?? "",
      // Blank rather than 0 on a new rung: 0 is refused by both the schema and
      // 0024, and pre-filling a value the admin must replace invites a typo.
      spend_threshold: row?.spend_threshold ?? "",
      is_active: row?.is_active ?? true,
    },
  })

  function onSubmit(values: MilestoneInput) {
    startTransition(async () => {
      const state = await saveMilestone(values)
      if (!state?.ok) {
        form.setError("root", { message: state?.message ?? m.saveFailed })
        toast.error(state?.message ?? m.saveFailed)
        return
      }
      toast.success(state.message)
      onSaved()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.name}</FormLabel>
              <FormControl>
                <Input {...field} value={fieldValue(field.value)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.description}</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} value={fieldValue(field.value)} />
              </FormControl>
              <FormDescription>{m.descriptionHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="spend_threshold"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.spendThreshold}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  step="1000"
                  inputMode="numeric"
                  {...field}
                  value={fieldValue(field.value)}
                />
              </FormControl>
              <FormDescription>{m.spendThresholdHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.imageUrl}</FormLabel>
              {/* Upload and paste write the same field, exactly as on a reward:
                  uploading fills it with a `media` bucket URL, and an externally
                  hosted image can still be pasted by hand. */}
              <ImageUpload
                value={fieldValue(field.value)}
                onChange={field.onChange}
                folder="milestones"
              />
              <FormControl>
                <Input
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  {...field}
                  value={fieldValue(field.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3">
              <FormControl>
                <Checkbox
                  className="mt-0.5"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="grid gap-0.5">
                <FormLabel>{m.status}</FormLabel>
                <FormDescription>{m.statusHelper}</FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormError message={form.formState.errors.root?.message} />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t.common.saving : t.common.save}
          </Button>
        </div>
      </form>
    </Form>
  )
}
