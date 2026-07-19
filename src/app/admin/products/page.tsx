import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import type { ProductPointRow } from "@/lib/db-types"
import { ProductForm } from "./product-form"
import { deleteProductPoint } from "./actions"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.products.metaTitle }
}

export default async function ProductsPage() {
  const t = await getMessages()
  const m = t.admin.products
  const supabase = await createClient()
  const { data } = await supabase
    .from("product_points")
    .select("*")
    .order("product_code", { ascending: true })

  const products = (data ?? []) as ProductPointRow[]

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-muted-foreground text-sm">{m.helper}</p>
      </div>

      <div className="grid gap-4">
        {products.length === 0 && (
          <p className="text-muted-foreground text-sm">{m.empty}</p>
        )}
        {products.map((product) => (
          <div key={product.id} className="grid gap-2 rounded-md border p-4">
            <ProductForm row={product} />
            <form action={deleteProductPoint} className="justify-self-end">
              <input type="hidden" name="id" value={product.id} />
              <Button type="submit" variant="outline" size="sm">
                {t.common.delete}
              </Button>
            </form>
          </div>
        ))}
      </div>

      <div className="grid gap-2 rounded-md border border-dashed p-4">
        <h2 className="text-sm font-medium">{m.addTitle}</h2>
        <ProductForm />
      </div>
    </div>
  )
}
