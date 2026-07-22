import Link from "next/link"

import { PageLink } from "@/components/page-link"

/**
 * The `SectionCard` footer every paginated admin table shares: a "showing N of
 * M" count on the left, prev/page/next on the right. Pass it straight to
 * `SectionCard`'s `footer` prop.
 */
export function Pagination({
  page,
  shown,
  total,
  hasNext,
  hrefFor,
  labels,
  firstIndex,
  pageSize,
}: {
  page: number
  shown: number
  total: number
  hasNext: boolean
  hrefFor: (page: number) => string
  labels: {
    showing: (shown: number, total: number) => string
    showingRange?: (first: number, last: number, total: number) => string
    page: (n: number) => string
    previous: string
    next: string
    pagination: string
  }
  /** 1-based index of the first row on this page — switches the count to a range. */
  firstIndex?: number
  /** Rows per page. Given both, the nav renders numbered page buttons. */
  pageSize?: number
}) {
  const pageCount = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : null
  // A window around the current page: a long ledger must not print 40 buttons.
  const numbers =
    pageCount == null
      ? []
      : Array.from({ length: pageCount }, (_, i) => i + 1).filter(
          (n) => Math.abs(n - page) <= 1 || n === 1 || n === pageCount,
        )

  return (
    <>
      <p className="text-label-md text-muted-foreground">
        {firstIndex != null && labels.showingRange
          ? labels.showingRange(firstIndex, firstIndex + shown - 1, total)
          : labels.showing(shown, total)}
      </p>
      <nav aria-label={labels.pagination} className="flex items-center gap-2">
        <PageLink
          href={hrefFor(page - 1)}
          disabled={page <= 1}
          direction="prev"
          label={labels.previous}
        />
        {numbers.length > 0 ? (
          numbers.map((n, index) => (
            <span key={n} className="flex items-center gap-2">
              {index > 0 && n - numbers[index - 1] > 1 && (
                <span className="text-muted-foreground text-label-md">…</span>
              )}
              <Link
                href={hrefFor(n)}
                aria-current={n === page ? "page" : undefined}
                aria-label={labels.page(n)}
                className={
                  n === page
                    ? "bg-primary-container text-primary-foreground text-label-md grid size-8 place-items-center rounded-lg font-semibold"
                    : "text-label-md text-muted-foreground hover:text-foreground hover:bg-surface-high grid size-8 place-items-center rounded-lg"
                }
              >
                {n}
              </Link>
            </span>
          ))
        ) : (
          <span className="text-label-md text-muted-foreground">
            {labels.page(page)}
          </span>
        )}
        <PageLink
          href={hrefFor(page + 1)}
          disabled={!hasNext}
          direction="next"
          label={labels.next}
        />
      </nav>
    </>
  )
}
