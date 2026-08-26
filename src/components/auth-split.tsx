import Image from "next/image"
import { CheckCircle2, PawPrint } from "lucide-react"

/**
 * The split screen every auth page uses
 * (`design/stitch_remix_of_loyalty_rewards_dashboard/ng_nh_p_ng_k_chicha_pet_rewards/`):
 * a marketing panel on the left, the form in its own card on the right.
 *
 * Two separate boxes with a gap, NOT one card cut in half — that is what the
 * mockup draws, and it is why the panel can disappear below `md` without
 * leaving a card with one empty half. On a phone only the form card remains.
 */
export function AuthSplit({
  brand,
  headline,
  tagline,
  benefits,
  tabs,
  children,
}: {
  brand: string
  headline: string
  tagline: string
  /** Selling points under the tagline. Omitted by `/admin/login`: that is a
   * staff door, and it has nothing to sell. */
  benefits?: string[]
  /** The Đăng nhập / Đăng ký strip, pinned to the top of the form card.
   * `/admin/login` passes none — staff have no second door to switch to. */
  tabs?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="bg-canvas relative grid min-h-svh place-items-center overflow-hidden p-4 md:p-8">
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 md:grid-cols-2 md:gap-12">
        {/* Hidden below `md`, as in the mockup: on a phone the form is the whole
            screen and a stacked marketing panel just pushes it below the fold. */}
        <aside className="bg-surface-low shadow-soft hidden flex-col justify-center gap-5 rounded-3xl p-6 md:flex md:p-10">
          <div className="flex items-center gap-2">
            <PawPrint className="text-primary size-6" aria-hidden />
            <span className="text-headline-md text-primary">{brand}</span>
          </div>
          <h2 className="text-display text-primary max-w-md">{headline}</h2>
          <p className="text-body-lg text-muted-foreground max-w-md">
            {tagline}
          </p>
          {benefits && benefits.length > 0 && (
            <ul className="grid max-w-md gap-3">
              {benefits.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-primary-container mt-0.5 size-5 shrink-0"
                    aria-hidden
                  />
                  {line}
                </li>
              ))}
            </ul>
          )}
          {/* A contained block, not a full-bleed background: at `opacity-60`
              behind the copy it was washing out the checklist. Decorative — the
              copy above carries the meaning. */}
          <div className="relative mt-2 h-56 w-full overflow-hidden rounded-2xl">
            <Image
              src="/auth-hero.jpg"
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </aside>

        <div className="border-border bg-card shadow-soft mx-auto w-full max-w-md rounded-3xl border p-6 md:p-8">
          {tabs}
          {children}
        </div>
      </div>
    </main>
  )
}
