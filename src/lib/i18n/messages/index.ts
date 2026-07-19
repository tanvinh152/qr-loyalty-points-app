import type { Locale } from "../config"
import { en, type Messages } from "./en"
import { vi } from "./vi"

// Both catalogs live in the bundle so the client provider can pick by locale
// without crossing the server/client boundary with (non-serializable) function
// values.
export const messages: Record<Locale, Messages> = { en, vi }

export type { Messages }
