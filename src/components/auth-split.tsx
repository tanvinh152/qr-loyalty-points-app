import Image from "next/image"
import { PawPrint } from "lucide-react"

/**
 * The split screen both auth pages use (`design/stitch-v2/img/dangnhap.png`):
 * a branded photo panel on the left, the form on the right, both inside one
 * floating card that sits over a dotted canvas with two blurred colour blobs.
 * The panel stacks above the form below `md`.
 */
export function AuthSplit({
  brand,
  headline,
  tagline,
  children,
}: {
  brand: string
  headline: string
  tagline: string
  children: React.ReactNode
}) {
  return (
    <main className="bg-background pattern-paws relative grid min-h-svh place-items-center overflow-hidden p-4 md:p-8">
      {/* One floating card holding both halves, as in the mockup — not two
          full-bleed columns. */}
      <div className="border-border bg-card relative z-10 grid w-full max-w-[1200px] overflow-hidden rounded-3xl border md:grid-cols-2">
        {/* The art half stays visible on phones, stacked above the form. */}
        <aside className="bg-surface-low relative isolate grid min-h-[300px] content-between gap-4 p-6 md:p-12">
          {/* Decorative: the copy beside it carries the meaning. */}
          <Image
            src="/auth-hero.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="-z-10 object-cover opacity-60"
          />
          <div
            aria-hidden
            className="from-background via-background/80 -z-10 absolute inset-0 bg-gradient-to-t to-transparent"
          />

          <div className="flex items-center gap-2">
            <PawPrint className="text-primary size-6" aria-hidden />
            <span className="text-headline-md text-primary">{brand}</span>
          </div>
          <div className="grid gap-4">
            <h2 className="text-display text-primary max-w-md">{headline}</h2>
            <p className="text-body-lg text-muted-foreground max-w-md">
              {tagline}
            </p>
          </div>
        </aside>

        <div className="grid content-center justify-items-center p-6 md:p-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </main>
  )
}
