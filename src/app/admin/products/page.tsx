import { Package } from "lucide-react"

import { ConfirmDelete } from "@/components/confirm-delete"
import { EmptyState } from "@/components/empty-state"
import { SectionCard } from "@/components/section-card"
import { PageHeader } from "@/components/page-header"
import { StatusDot } from "@/components/status-dot"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { listVariations } from "@/lib/pancake/client"
import type { ProductPointRow } from "@/lib/db-types"
import { ProductDialog } from "./product-form"
import { deleteProductPoint } from "./actions"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.products.metaTitle }
}

export default async function ProductsPage() {
  const t = await getMessages()
  const m = t.admin.products
  const supabase = await createClient()
  const [{ data }, catalog] = await Promise.all([
    supabase
      .from("product_points")
      .select("*")
      .order("product_code", { ascending: true }),
    // Pancake being down must never take the page down; the picker degrades to
    // a plain SKU field.
    listVariations().catch(() => null),
  ])

  const products = (data ?? []) as ProductPointRow[]
  const mappedSkus = products.map((p) => p.product_code)

  return (
    <div className="grid gap-6">
      <PageHeader title={m.title} description={m.helper} />

      <SectionCard
        title={m.listTitle}
        actions={<ProductDialog catalog={catalog} mappedSkus={mappedSkus} />}
      >
        {products.length === 0 ? (
          <EmptyState title={m.empty} icon={Package} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.productCode}</TableHead>
                <TableHead>{m.label}</TableHead>
                <TableHead className="text-right">{m.pointsAwarded}</TableHead>
                <TableHead>{m.status}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-body-xs">
                    {product.product_code}
                  </TableCell>
                  <TableCell className="text-body-sm font-semibold">
                    {product.label ?? "—"}
                  </TableCell>
                  <TableCell className="text-primary text-right font-bold tabular-nums">
                    {product.points_awarded.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <StatusDot
                      label={
                        product.is_active ? t.common.active : t.common.inactive
                      }
                      tone={product.is_active ? "success" : "neutral"}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <ProductDialog
                        row={product}
                        catalog={catalog}
                        mappedSkus={mappedSkus}
                      />
                      <ConfirmDelete
                        name={product.label || product.product_code}
                        onConfirm={deleteProductPoint.bind(null, product.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
