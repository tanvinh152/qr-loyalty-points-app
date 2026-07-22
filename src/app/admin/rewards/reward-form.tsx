"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { FormDialog } from "@/components/form-dialog"
import { FormError } from "@/components/form-error"
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
  makeRewardSchema,
  type RewardFormValues,
  type RewardInput,
} from "@/lib/schemas"
import type { RewardRow } from "@/lib/db-types"
import { saveReward } from "./actions"

/** Create/edit dialog for a reward. `trigger` overrides the default button. */
export function RewardDialog({
  row,
  categories = [],
  trigger,
}: {
  row?: RewardRow
  /** Existing category slugs, offered as a datalist on the free-text field. */
  categories?: string[]
  trigger?: React.ReactNode
}) {
  const t = useT()
  const m = t.admin.rewards

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
    >
      {(close) => (
        <RewardFields row={row} categories={categories} onSaved={close} />
      )}
    </FormDialog>
  )
}

function RewardFields({
  row,
  categories,
  onSaved,
}: {
  row?: RewardRow
  categories: string[]
  onSaved: () => void
}) {
  const t = useT()
  const m = t.admin.rewards
  const [isPending, startTransition] = useTransition()

  const form = useForm<RewardFormValues, unknown, RewardInput>({
    resolver: zodResolver(makeRewardSchema(t.validation)),
    defaultValues: {
      id: row?.id,
      name: row?.name ?? "",
      description: row?.description ?? "",
      points_cost: row?.points_cost ?? 0,
      original_points_cost: row?.original_points_cost ?? "",
      quantity: row?.quantity ?? 0,
      image_url: row?.image_url ?? "",
      category: row?.category ?? "",
      is_exclusive: row?.is_exclusive ?? false,
      is_featured: row?.is_featured ?? false,
      is_active: row?.is_active ?? true,
    },
  })

  function onSubmit(values: RewardInput) {
    startTransition(async () => {
      const state = await saveReward(values)
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
                <Textarea {...field} value={fieldValue(field.value)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="points_cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.pointsCost}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.pointsCostHelper}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="original_points_cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.originalPointsCost}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.originalPointsCostHelper}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.quantity}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.quantityHelper}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.imageUrl}</FormLabel>
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
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.category}</FormLabel>
              <FormControl>
                {/* Free text with a datalist rather than a Select: the shop's
                    tab bar is built from whatever slugs exist, so adding one
                    must not need a code change. */}
                <Input
                  list="reward-categories"
                  {...field}
                  value={fieldValue(field.value)}
                />
              </FormControl>
              <datalist id="reward-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              <FormDescription>{m.categoryHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3">
                <FormControl>
                  <Checkbox
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel>{m.status}</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="is_exclusive"
            render={({ field }) => (
              <FormItem className="grid gap-1">
                <div className="flex flex-row items-center gap-3">
                  <FormControl>
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>{m.isExclusive}</FormLabel>
                </div>
                <FormDescription>{m.isExclusiveHelper}</FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="is_featured"
            render={({ field }) => (
              <FormItem className="grid gap-1">
                <div className="flex flex-row items-center gap-3">
                  <FormControl>
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>{m.isFeatured}</FormLabel>
                </div>
                <FormDescription>{m.isFeaturedHelper}</FormDescription>
              </FormItem>
            )}
          />
        </div>

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
