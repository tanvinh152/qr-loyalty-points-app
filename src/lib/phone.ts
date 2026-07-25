// Phone normalization + masked-phone matching.
//
// Pancake masks phones as "0****70" — first digit plus the last two, length
// hidden. So the strongest check available is prefix + suffix. Combined with
// needing the order code and the rate limiter, that is the ownership gate for
// registration. If an API key ever returns UNMASKED phones, `matchesMask` degrades
// naturally into an exact comparison (no `*` -> full string equality).

const MASK_CHAR = "*"

// "+84 90 123 45 94" / "8490..." / "090-123..." -> "0901234594"
export function normalizePhone(input: string): string {
  const digitsOnly = input.replace(/[^\d+]/g, "")
  if (digitsOnly.startsWith("+84")) return "0" + digitsOnly.slice(3)
  if (digitsOnly.startsWith("84") && digitsOnly.length >= 10) {
    return "0" + digitsOnly.slice(2)
  }
  return digitsOnly.replace(/^\+/, "")
}

// Vietnamese mobile: ten digits, leading 0, then one of the live mobile
// prefixes. This is deliberately strict because the normalized phone IS the
// account key — the unique column in `customers` and what sign-in looks the
// member's auth email up by. Accepting "901234567" and "0901234567" as separate
// strings hands the same person two accounts and splits their points across both.
export const VN_MOBILE_RE = /^0[35789]\d{8}$/

export function isValidVnPhone(input: string): boolean {
  return VN_MOBILE_RE.test(normalizePhone(input))
}

/**
 * True when a value coming back from Pancake tells us nothing real — it is
 * absent, blank, or still carries the mask ("0****52", "L******h").
 *
 * Fails closed on purpose: an unreadable value counts as masked, so callers err
 * towards "Pancake is missing this" rather than towards writing a mask onwards.
 */
export function isMasked(value: string | null | undefined): boolean {
  const trimmed = value?.trim()
  return !trimmed || trimmed.includes(MASK_CHAR)
}

// Fails closed: an empty or all-masked value never matches.
export function matchesMask(
  input: string,
  mask: string | null | undefined,
): boolean {
  if (!mask) return false
  const phone = normalizePhone(input)
  if (!phone) return false

  const maskTrimmed = mask.trim()
  if (!maskTrimmed.includes(MASK_CHAR)) {
    // Unmasked value — require an exact match.
    return normalizePhone(maskTrimmed) === phone
  }

  const first = maskTrimmed.indexOf(MASK_CHAR)
  const last = maskTrimmed.lastIndexOf(MASK_CHAR)
  const prefix = maskTrimmed.slice(0, first).replace(/\D/g, "")
  const suffix = maskTrimmed.slice(last + 1).replace(/\D/g, "")

  // Nothing visible at all -> cannot prove ownership.
  if (!prefix && !suffix) return false
  // The mask hides at least one digit, so the visible parts must not cover the
  // whole input (otherwise "094" would satisfy "0****94").
  if (phone.length <= prefix.length + suffix.length) return false

  return phone.startsWith(prefix) && phone.endsWith(suffix)
}

/**
 * The registration ownership gate, against every number an order carries.
 *
 * A mask reveals one digit and the last two, so on its own it accepts about one
 * random Vietnamese number in ten thousand. But Pancake does not mask what it
 * has been told: a record written by us (or typed by staff) comes back as
 * ["0****52", "0376733152"]. Whenever such a real number is there, it is the
 * only thing compared — the masks alongside it are ignored, because accepting
 * them would keep the weak test alive next to a strong one.
 *
 * The mask fallback therefore applies only to records where nothing better
 * exists. Signing up against one of those writes the real number back (see
 * updateCustomer), which promotes that record to the exact-match path for good.
 *
 * Fails closed: no candidates, or nothing but blanks, never matches.
 */
export function matchesOrderPhones(
  input: string,
  candidates: (string | null | undefined)[],
): boolean {
  const phone = normalizePhone(input)
  if (!phone) return false

  const known = candidates.filter((c): c is string => Boolean(c?.trim()))
  const real = known.filter((c) => !isMasked(c))

  if (real.length > 0) {
    return real.some((c) => normalizePhone(c) === phone)
  }
  return known.some((mask) => matchesMask(phone, mask))
}
