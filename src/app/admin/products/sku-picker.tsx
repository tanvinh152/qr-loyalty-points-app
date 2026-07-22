"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { AlertTriangle, Package, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/provider"
import { cn, formatVnd } from "@/lib/utils"
import type { CatalogVariation } from "@/lib/pancake/types"

const THUMB = 40

/**
 * Picks a Pancake variation SKU and submits it as `product_code`, so the form
 * contract is identical to the plain text input it replaced.
 *
 * `catalog === null` means the Pancake call failed — we fall back to that text
 * input rather than blocking the admin from saving.
 */
export function SkuPicker({
  catalog,
  value,
  exclude,
  onSelect,
  onValueChange,
  id,
}: {
  catalog: CatalogVariation[] | null
  /** Existing product_code when editing a row. */
  value?: string
  /** SKUs already mapped elsewhere — hidden from the list. */
  exclude?: string[]
  /** Fired with the picked variation so the form can suggest a label. */
  onSelect?: (variation: CatalogVariation) => void
  /** Fired with the raw SKU — this is what the form field binds to. */
  onValueChange?: (sku: string) => void
  id: string
}) {
  const t = useT()
  const m = t.admin.products

  const [selected, setSelected] = useState(value ?? "")
  const [query, setQuery] = useState("")

  const current = catalog?.find((v) => v.sku === selected) ?? null

  const options = useMemo(() => {
    if (!catalog) return []
    // The row's own SKU stays selectable; only *other* rows' SKUs are excluded.
    const taken = new Set((exclude ?? []).filter((sku) => sku !== value))
    const list = catalog.filter((v) => !taken.has(v.sku))
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((v) =>
      `${v.name} ${v.attrs} ${v.sku}`.toLowerCase().includes(q),
    )
  }, [catalog, exclude, query, value])

  // Degraded mode: Pancake unreachable.
  if (!catalog) {
    return (
      <div className="grid gap-1">
        <Label htmlFor={id}>{m.productCode}</Label>
        <Input
          id={id}
          name="product_code"
          defaultValue={value ?? ""}
          onChange={(e) => onValueChange?.(e.target.value)}
          placeholder="SP000001"
          required
        />
        <p className="text-body-sm text-warning flex items-center gap-1.5">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {m.catalogUnavailable}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name="product_code" value={selected} required />

      {selected ? (
        <SelectedCard
          sku={selected}
          variation={current}
          onChange={() => {
            setSelected("")
            onValueChange?.("")
          }}
        />
      ) : (
        <>
          <Label htmlFor={id}>{m.pickSku}</Label>
          <Input
            id={id}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={m.searchSku}
            icon={Search}
            className="text-body-sm h-10"
          />
          <div className="border-border/60 max-h-64 overflow-y-auto rounded-lg border">
            {options.length === 0 && (
              <p className="text-body-sm text-muted-foreground p-4 text-center">
                {query.trim() ? m.noSkuMatch : m.noSkusLeft}
              </p>
            )}
            {options.map((v) => (
              <button
                key={v.sku}
                type="button"
                onClick={() => {
                  setSelected(v.sku)
                  setQuery("")
                  onValueChange?.(v.sku)
                  onSelect?.(v)
                }}
                className="border-border/40 hover:bg-accent flex w-full items-center gap-3 border-b p-2 text-left transition-colors last:border-b-0"
              >
                <Thumb src={v.image} alt={v.name} />
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-body-sm truncate font-medium">
                    {v.name}
                  </span>
                  <span className="text-muted-foreground truncate text-body-xs">
                    {[v.attrs, v.sku].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SelectedCard({
  sku,
  variation,
  onChange,
}: {
  sku: string
  variation: CatalogVariation | null
  onChange: () => void
}) {
  const t = useT()
  const m = t.admin.products

  return (
    <div className="border-border/60 bg-surface-container/40 flex items-start gap-3 rounded-lg border p-3">
      <Thumb src={variation?.image ?? null} alt={variation?.name ?? sku} />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="text-body-sm truncate font-medium">
          {variation?.name ?? sku}
        </p>
        {variation?.attrs && (
          <p className="text-muted-foreground truncate text-body-xs">
            {variation.attrs}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="muted">{sku}</Badge>
          {variation?.price != null && (
            <span className="text-muted-foreground text-body-xs">
              {m.price}: {formatVnd(variation.price)}
            </span>
          )}
          {variation?.remain != null && (
            <span className="text-muted-foreground text-body-xs">
              {m.stock}: {variation.remain.toLocaleString()}
            </span>
          )}
        </div>
        {!variation && (
          <p className="text-warning flex items-center gap-1.5 text-body-xs">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            {m.unknownSku}
          </p>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onChange}>
        {m.changeSku}
      </Button>
    </div>
  )
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span
      className={cn(
        "bg-surface-container grid shrink-0 place-items-center overflow-hidden rounded-md",
        "size-10",
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={THUMB}
          height={THUMB}
          className="size-10 object-cover"
        />
      ) : (
        <Package className="text-muted-foreground size-4" aria-hidden />
      )}
    </span>
  )
}
