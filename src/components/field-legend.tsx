import { Info } from "lucide-react"

/**
 * Explains what each column of a repeated admin form means. Rendered once per
 * page instead of under every row, which would repeat the same hint N times.
 */
export function FieldLegend({
  items,
}: {
  items: { term: string; hint: string }[]
}) {
  return (
    <dl className="bg-surface-container/50 border-border text-body-sm grid gap-1.5 rounded-xl border p-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.term} className="flex items-start gap-2">
          <Info
            className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
            aria-hidden
          />
          <div>
            <dt className="inline font-medium">{item.term}: </dt>
            <dd className="text-muted-foreground inline">{item.hint}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
