import { getTiers } from "@/lib/loyalty"
import { getMessages } from "@/lib/i18n/server"
import { formatVnd } from "@/lib/utils"

import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages()
  return { title: t.terms.metaTitle }
}

// The tier table is rendered from getTiers(), never hardcoded, so this page can
// never contradict /tiers or the database — the two have drifted before.
//
// Deliberately NOT published here, because the system does not enforce them:
//   • §8.1's "1.000đ = 1 point" — points come from the per-product table times
//     the tier multiplier, so publishing the formula would be a false promise.
//   • §8.3.5's 15/30-day voucher expiry — there is no voucher engine yet.
// Both are open items for the client; see docs/gap-analysis-vs-client-spec.md.
export default async function TermsPage() {
  const [t, tiers] = await Promise.all([getMessages(), getTiers()])
  const tm = t.terms

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-headline-lg">{tm.title}</h1>
        <p className="text-muted-foreground">{tm.subtitle}</p>
      </header>

      {tm.sections.map((section) => (
        <section key={section.id} id={section.id} className="grid gap-3">
          <h2 className="text-headline-md">{section.title}</h2>
          {section.paragraphs.map((p) => (
            <p key={p} className="text-muted-foreground">
              {p}
            </p>
          ))}

          {/* The tier ladder belongs inside its own section, straight from the DB. */}
          {section.id === "tiers" && tiers.length > 0 && (
            <div className="border-border bg-card shadow-soft mt-2 overflow-x-auto rounded-3xl border">
              <table className="w-full min-w-[22rem] text-left">
                <caption className="sr-only">{tm.tierTableTitle}</caption>
                <thead>
                  <tr className="border-border text-label-md text-muted-foreground border-b uppercase">
                    <th scope="col" className="px-5 py-3">
                      {tm.colTier}
                    </th>
                    <th scope="col" className="px-5 py-3">
                      {tm.colCondition}
                    </th>
                    <th scope="col" className="px-5 py-3">
                      {tm.colMultiplier}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {tiers.map((tier) => (
                    <tr key={tier.id}>
                      <th scope="row" className="px-5 py-3 font-semibold">
                        {tier.name}
                      </th>
                      <td className="px-5 py-3 tabular-nums">
                        {formatVnd(tier.spend_threshold)}
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        {tier.multiplier}×
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
