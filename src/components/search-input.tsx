import { Search } from "@/components/animate-ui/icons/search"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * GET form with a single icon-prefixed field. Submitting navigates — no client
 * component needed, which is why the dashboard and the customer list both use it.
 */
export function SearchInput({
  action,
  name = "q",
  defaultValue,
  placeholder,
  label,
  hidden,
  className,
}: {
  action: string
  name?: string
  defaultValue?: string
  placeholder: string
  /** Screen-reader label; the design shows no visible label. */
  label: string
  /**
   * Extra query params to carry through the submit. A GET form replaces the
   * whole query string, so anything the page reads besides `name` — the gift
   * screen's `kind` tab, say — has to ride along or searching resets it.
   */
  hidden?: Record<string, string>
  className?: string
}) {
  return (
    <form action={action} className={cn("w-full sm:w-80", className)}>
      {Object.entries(hidden ?? {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label className="sr-only" htmlFor={`${name}-search`}>
        {label}
      </label>
      <Input
        id={`${name}-search`}
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        icon={Search}
        className="text-body-sm h-10"
      />
    </form>
  )
}
