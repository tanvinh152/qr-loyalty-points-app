"use client"

import { useTransition } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { FormDialog } from "@/components/form-dialog"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
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
  makeTierSchema,
  type TierFormValues,
  type TierInput,
} from "@/lib/schemas"
import { MAX_PERKS, PERK_ICON_KEYS, type PerkIconKey } from "@/lib/tier-perks"
import { saveTier } from "./actions"
import type { MembershipTierRow } from "@/lib/db-types"

/**
 * Create/edit dialog for a membership tier. Passing `row` makes it the edit
 * form for that tier; omitting it makes it the "add" form.
 */
export function TierDialog({ row }: { row?: MembershipTierRow }) {
  const t = useT()
  const m = t.admin.tiers

  return (
    <FormDialog
      title={row ? `${t.common.edit} — ${row.name}` : m.addTitle}
      description={m.helper}
      trigger={
        row ? (
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
      }
    >
      {(close) => <TierFields row={row} onSaved={close} />}
    </FormDialog>
  )
}

function TierFields({
  row,
  onSaved,
}: {
  row?: MembershipTierRow
  onSaved: () => void
}) {
  const t = useT()
  const m = t.admin.tiers
  const [isPending, startTransition] = useTransition()

  // Three generics because the schema coerces: the fields hold strings while
  // the user types, and `handleSubmit` hands the parsed numbers to `onSubmit`.
  const form = useForm<TierFormValues, unknown, TierInput>({
    resolver: zodResolver(makeTierSchema(t.validation)),
    defaultValues: {
      id: row?.id,
      name: row?.name ?? "",
      threshold: row?.threshold ?? 0,
      multiplier: row?.multiplier ?? 1,
      sort_order: row?.sort_order ?? 0,
      benefits: row?.benefits ?? "",
      // The column defaults to '[]', but a row written before 0007 can arrive
      // without the key at all — and `icon` is free text in the DB, so a value
      // outside the vocabulary falls back instead of breaking the Select.
      perks: (row?.perks ?? []).map((perk) => ({
        icon: (PERK_ICON_KEYS as readonly string[]).includes(perk.icon)
          ? (perk.icon as PerkIconKey)
          : "sparkles",
        title: perk.title,
        detail: perk.detail ?? "",
      })),
    },
  })

  const perks = useFieldArray({ control: form.control, name: "perks" })

  function onSubmit(values: TierInput) {
    startTransition(async () => {
      const state = await saveTier(values)
      if (!state?.ok) {
        // Pinned in the dialog as well as toasted — the toast can land behind
        // the overlay on a phone.
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
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="threshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.threshold}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.thresholdHelper}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="multiplier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.multiplier}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    {...field}
                    value={fieldValue(field.value)}
                  />
                </FormControl>
                <FormDescription>{m.multiplierHelper}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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

        <FormField
          control={form.control}
          name="benefits"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.benefits}</FormLabel>
              <FormControl>
                <Input {...field} value={fieldValue(field.value)} />
              </FormControl>
              <FormDescription>{m.benefitsHelper}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Perk rows. Not a SectionCard: this is inside a dialog, and the
            repeated group only needs a label and a divider. */}
        <div className="border-border grid gap-4 rounded-xl border p-4">
          <div className="grid gap-1">
            <p className="text-label-md">{m.perks}</p>
            <p className="text-muted-foreground text-body-xs">
              {m.perksHelper}
            </p>
          </div>

          {perks.fields.length === 0 && (
            <p className="text-muted-foreground text-body-sm">{m.perkNone}</p>
          )}

          {perks.fields.map((perk, index) => (
            <div
              key={perk.id}
              className="border-border grid gap-3 border-t pt-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
            >
              <FormField
                control={form.control}
                name={`perks.${index}.icon`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.perkIcon}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={PERK_ICON_KEYS.map((key) => ({
                        value: key,
                        label: m.perkIcons[key],
                      }))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PERK_ICON_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {m.perkIcons[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-3">
                <FormField
                  control={form.control}
                  name={`perks.${index}.title`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{m.perkTitle}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={m.perkTitlePlaceholder}
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
                  name={`perks.${index}.detail`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{m.perkDetail}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={m.perkDetailPlaceholder}
                          {...field}
                          value={fieldValue(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                aria-label={`${m.perkRemove} ${index + 1}`}
                onClick={() => perks.remove(index)}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={perks.fields.length >= MAX_PERKS}
            onClick={() =>
              perks.append({ icon: "sparkles", title: "", detail: "" })
            }
          >
            <Plus aria-hidden />
            {m.perkAdd}
          </Button>
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
