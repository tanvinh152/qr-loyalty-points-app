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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useT } from "@/lib/i18n/provider"
import {
  makeSpinPrizeSchema,
  type SpinPrizeFormValues,
  type SpinPrizeInput,
} from "@/lib/schemas"
import type { RewardRow } from "@/lib/db-types"
import { saveSpinPrize } from "./actions"

/** Create/edit dialog for one wedge. `trigger` overrides the default button. */
export function SpinPrizeDialog({
  row,
  trigger,
}: {
  /** A `kind = 'spin'` reward row; only the wheel columns are read. */
  row?: RewardRow
  trigger?: React.ReactNode
}) {
  const t = useT()
  const m = t.admin.rewards.spin

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
      {(close) => <SpinPrizeFields row={row} onSaved={close} />}
    </FormDialog>
  )
}

/**
 * A brand-new gift slice defaults to real stock. 0 would mean "sold out", which
 * drops it straight out of the draw (0022) — an admin adding a prize means to
 * give it away, not to shelve it.
 */
const DEFAULT_GIFT_STOCK = 10

function SpinPrizeFields({
  row,
  onSaved,
}: {
  row?: RewardRow
  onSaved: () => void
}) {
  const t = useT()
  const m = t.admin.rewards.spin
  const [isPending, startTransition] = useTransition()

  const form = useForm<SpinPrizeFormValues, unknown, SpinPrizeInput>({
    resolver: zodResolver(makeSpinPrizeSchema(t.validation)),
    defaultValues: {
      id: row?.id,
      name: row?.name ?? "",
      image_url: row?.image_url ?? "",
      prize_type: row?.prize_type ?? "points",
      points_amount: row?.points_amount ?? 0,
      quantity: row?.quantity ?? DEFAULT_GIFT_STOCK,
      weight: row?.weight ?? 1,
      is_active: row?.is_active ?? true,
      sort_order: row?.sort_order ?? 0,
    },
  })

  // Only a points slice has an amount to enter, and only a gift has stock; both
  // fields are hidden rather than disabled, and the action zeroes the columns
  // that do not apply to the chosen type anyway.
  const prizeType = form.watch("prize_type")

  const typeOptions = [
    { value: "points", label: m.typePoints },
    { value: "gift", label: m.typeGift },
    { value: "none", label: m.typeNone },
  ]

  function onSubmit(values: SpinPrizeInput) {
    startTransition(async () => {
      const state = await saveSpinPrize(values)
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
          name="prize_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.prizeType}</FormLabel>
              <Select
                value={fieldValue(field.value)}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{m.prizeTypeHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {prizeType === "points" && (
          <FormField
            control={form.control}
            name="points_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.pointsAmount}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.pointsAmountHelper}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {prizeType === "gift" && (
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
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.weight}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.weightHelper}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sort_order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.sortOrder}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.sortOrderHelper}</FormDescription>
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
              {/* Upload and paste write the same field, exactly as on a reward:
                  uploading fills it with a `media` bucket URL, and an externally
                  hosted image can still be pasted by hand. */}
              <ImageUpload
                value={fieldValue(field.value)}
                onChange={field.onChange}
                folder="spin"
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
                  onCheckedChange={(v) => field.onChange(v === true)}
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
