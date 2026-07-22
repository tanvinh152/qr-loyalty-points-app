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
import { useT } from "@/lib/i18n/provider"
import {
  makeProductPointSchema,
  type ProductPointFormValues,
  type ProductPointInput,
} from "@/lib/schemas"
import type { CatalogVariation } from "@/lib/pancake/types"
import type { ProductPointRow } from "@/lib/db-types"
import { saveProductPoint } from "./actions"
import { SkuPicker } from "./sku-picker"

type Props = {
  row?: ProductPointRow
  /** Pancake variations, or null when the catalog could not be fetched. */
  catalog: CatalogVariation[] | null
  /** SKUs already mapped, so the picker can hide them. */
  mappedSkus?: string[]
}

/** Create/edit dialog for one SKU → points mapping. */
export function ProductDialog({ row, catalog, mappedSkus }: Props) {
  const t = useT()
  const m = t.admin.products
  const name = row?.label || row?.product_code || ""

  return (
    <FormDialog
      title={row ? `${t.common.edit} — ${name}` : m.addTitle}
      description={m.helper}
      trigger={
        row ? (
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={`${t.common.edit} — ${name}`}
          >
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button type="button">
            <Plus aria-hidden />
            {m.addTitle}
          </Button>
        )
      }
    >
      {(close) => (
        <ProductFields
          row={row}
          catalog={catalog}
          mappedSkus={mappedSkus}
          onSaved={close}
        />
      )}
    </FormDialog>
  )
}

function ProductFields({
  row,
  catalog,
  mappedSkus,
  onSaved,
}: Props & { onSaved: () => void }) {
  const t = useT()
  const m = t.admin.products
  const [isPending, startTransition] = useTransition()

  const form = useForm<ProductPointFormValues, unknown, ProductPointInput>({
    resolver: zodResolver(makeProductPointSchema(t.validation)),
    defaultValues: {
      id: row?.id,
      product_code: row?.product_code ?? "",
      label: row?.label ?? "",
      points_awarded: row?.points_awarded ?? 0,
      is_active: row?.is_active ?? true,
    },
  })

  // Only ever fills a blank label — never overwrites what the admin typed.
  function suggestLabel(variation: CatalogVariation) {
    if (form.getValues("label")?.toString().trim()) return
    form.setValue(
      "label",
      [variation.name, variation.attrs].filter(Boolean).join(" — "),
    )
  }

  function onSubmit(values: ProductPointInput) {
    startTransition(async () => {
      const state = await saveProductPoint(values)
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
          name="product_code"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <SkuPicker
                  id="product_code"
                  catalog={catalog}
                  value={fieldValue(field.value)}
                  exclude={mappedSkus}
                  onValueChange={field.onChange}
                  onSelect={suggestLabel}
                />
              </FormControl>
              <FormDescription>{m.productCodeHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.label}</FormLabel>
              <FormControl>
                <Input {...field} value={fieldValue(field.value)} />
              </FormControl>
              <FormDescription>{m.labelHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="points_awarded"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.pointsAwarded}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  {...field}
                  value={fieldValue(field.value)}
                />
              </FormControl>
              <FormDescription>{m.pointsAwardedHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
