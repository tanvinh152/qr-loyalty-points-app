"use server"

import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { matchesMask, normalizePhone, phoneToEmail } from "@/lib/phone"
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit"
import { getOrder, orderMaskedPhone } from "@/lib/pancake/client"
import { linkAuthUserToPhone } from "@/lib/loyalty"
import { SIGNUP_REQUIRES_PROOF } from "@/lib/customer-auth"
import {
  makeCustomerLoginSchema,
  makeCustomerSignupSchema,
} from "@/lib/schemas"

// Customer accounts are phone + password. Supabase Auth's password provider is
// email-keyed, so the phone is turned into a synthetic address by phoneToEmail()
// — no SMS provider, no OTP cost. Signup goes through the admin API so neither
// Supabase's email validator nor its confirmation mail is in the way (verified:
// the public /auth/v1/signup endpoint answers `email_address_invalid` for a
// synthetic domain). The signup ownership gate lives in src/lib/customer-auth.ts.

export type AuthState = { error: string } | null

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getMessages()
  const e = t.customer.errors

  const parsed = makeCustomerLoginSchema(t.validation).safeParse({
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? e.signInFailed }
  }

  // Same Postgres-backed counter as /claim — a password guesser and an order
  // code guesser share one budget per IP.
  const ip = await getClientIp()
  if (await isRateLimited(ip)) return { error: e.rateLimited }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(parsed.data.phone),
    password: parsed.data.password,
  })

  if (error) {
    await recordAttempt(ip, null, false)
    return { error: e.invalidCredentials }
  }

  redirect("/dashboard")
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getMessages()
  const e = t.customer.errors

  const parsed = makeCustomerSignupSchema(t.validation).safeParse({
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
    terms: formData.get("terms") === "on" || formData.get("terms") === "true",
    order_code: String(formData.get("order_code") ?? ""),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? e.signupFailed }
  }

  const ip = await getClientIp()
  if (await isRateLimited(ip)) return { error: e.rateLimited }

  const phone = normalizePhone(parsed.data.phone)

  if (SIGNUP_REQUIRES_PROOF) {
    const orderCode = parsed.data.order_code?.trim()
    if (!orderCode) return { error: e.proofRequired }
    try {
      const order = await getOrder(orderCode)
      if (!matchesMask(phone, orderMaskedPhone(order))) {
        await recordAttempt(ip, orderCode, false)
        return { error: e.proofFailed }
      }
    } catch {
      await recordAttempt(ip, orderCode, false)
      return { error: e.proofFailed }
    }
  }

  const email = phoneToEmail(phone)

  // Created with the admin API rather than auth.signUp() on purpose: the public
  // endpoint runs Supabase's email validator (it rejects synthetic domains) and
  // queues a confirmation mail to an address that does not exist. admin.createUser
  // skips both and marks the address confirmed, so signup works no matter how the
  // project's email settings are configured. Nothing here sets app_metadata —
  // customers must never carry the admin role claim (see is_admin() in 0005).
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { phone },
  })

  if (error || !data.user) {
    await recordAttempt(ip, null, false)
    // Supabase answers "already been registered" for a taken alias.
    const taken = error?.message?.toLowerCase().includes("already")
    return { error: taken ? e.phoneTaken : e.signupFailed }
  }

  // Carries over points claimed anonymously against this phone before signup.
  const linked = await linkAuthUserToPhone(data.user.id, phone)
  if (!linked.ok) {
    // Roll the account back rather than leaving a login with no points behind it.
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: e.phoneTaken }
  }

  // createUser does not issue a session, so sign in to set the cookies.
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  })
  if (signInError) return { error: e.signInFailed }

  redirect("/dashboard")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
