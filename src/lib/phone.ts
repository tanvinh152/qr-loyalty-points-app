// Phone normalization + masked-phone matching.
//
// Pancake masks phones as "0****70" — first digit plus the last two, length
// hidden. So the strongest check available is prefix + suffix. Combined with
// needing the order code and the rate limiter, that is the ownership gate for
// /claim. If an API key ever returns UNMASKED phones, `matchesMask` degrades
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

// Customer accounts are phone + password, but Supabase Auth's password provider
// is keyed by email — so the phone becomes a synthetic address. Normalizing
// first is what keeps the alias 1:1 with `customers.phone`, whatever format the
// customer typed. The domain is never mailed to; email confirmation is off.
const EMAIL_DOMAIN =
  process.env.CUSTOMER_EMAIL_DOMAIN ?? "customer.chicha-label.app"

export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@${EMAIL_DOMAIN}`
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
