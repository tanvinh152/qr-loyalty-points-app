"use server"

import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { matchesOrderPhones, normalizePhone, phoneToEmail } from "@/lib/phone"
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit"
import {
  canonicalOrderCode,
  getOrder,
  orderPhoneCandidates,
  orderSpendTotal,
  toRpcItems,
  updateCustomer,
} from "@/lib/pancake/client"
import {
  getActiveSettings,
  getCustomerByAuthUserId,
  getCustomerByPancakeId,
  linkAuthUserToPhone,
  linkPancakeCustomer,
} from "@/lib/loyalty"
import { setThemeCookie } from "@/lib/theme/actions"
import { themeForDob } from "@/lib/theme/config"
import { getTheme } from "@/lib/theme/server"
import {
  makeCustomerLoginSchema,
  makeCustomerSignupSchema,
} from "@/lib/schemas"

// Customer accounts are phone + password. Supabase Auth's password provider is
// email-keyed, so the phone is turned into a synthetic address by phoneToEmail()
// — no SMS provider, no OTP cost. Signup goes through the admin API so neither
// Supabase's email validator nor its confirmation mail is in the way (verified:
// the public /auth/v1/signup endpoint answers `email_address_invalid` for a
// synthetic domain).
//
// Registration is also the LINKING step: it demands a recent order code, proves
// the phone against that order's masked number, claims the order's points, and
// stores `pancake_customer_id` so every later order is credited automatically by
// the webhook. There is no manual claim screen any more.

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

  // One Postgres-backed counter for both forms — a password guesser and an order
  // code guesser share one budget per IP.
  const ip = await getClientIp()
  if (await isRateLimited(ip)) return { error: e.rateLimited }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(parsed.data.phone),
    password: parsed.data.password,
  })

  if (error) {
    await recordAttempt(ip, null, false)
    return { error: e.invalidCredentials }
  }

  // Seed the age default only when the member has not already chosen a theme —
  // a prior manual toggle (cookie present) must survive re-login.
  if (data.user && (await getTheme()) === null) {
    const customer = await getCustomerByAuthUserId(data.user.id)
    await setThemeCookie(themeForDob(customer?.date_of_birth ?? null))
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
    full_name: String(formData.get("full_name") ?? ""),
    date_of_birth: String(formData.get("date_of_birth") ?? ""),
    terms: formData.get("terms") === "on" || formData.get("terms") === "true",
    order_code: String(formData.get("order_code") ?? ""),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? e.signupFailed }
  }

  const ip = await getClientIp()
  if (await isRateLimited(ip)) return { error: e.rateLimited }

  const phone = normalizePhone(parsed.data.phone)
  const fullName = parsed.data.full_name

  // Everything that can legitimately reject the signup happens BEFORE the auth
  // user exists, so a business failure leaves nothing behind to roll back.
  const typedCode = parsed.data.order_code
  let order
  try {
    order = await getOrder(typedCode)
  } catch {
    await recordAttempt(ip, typedCode, false)
    return { error: e.proofFailed }
  }

  // Exact match against any real number the order carries, mask only where
  // Pancake has nothing better. One message either way: telling the two apart
  // would leak whether the shop already knows a given phone.
  if (!matchesOrderPhones(phone, orderPhoneCandidates(order))) {
    await recordAttempt(ip, typedCode, false)
    return { error: e.proofFailed }
  }

  // Without a POS customer id the account could never be attributed by the
  // webhook, which is the whole point of asking for an order at signup.
  const pancakeCustomerId = order.customer?.customer_id
  if (!pancakeCustomerId) {
    await recordAttempt(ip, typedCode, false)
    return { error: e.orderNotLinkable }
  }

  // That POS customer may already back somebody else's account. Refuse loudly
  // rather than let linkPancakeCustomer's fill-if-NULL quietly leave this account
  // unlinked — an unlinked account is invisible to the webhook forever.
  const alreadyLinked = await getCustomerByPancakeId(pancakeCustomerId)
  if (alreadyLinked && alreadyLinked.phone !== phone) {
    return { error: e.orderAlreadyLinked }
  }

  const orderCode = canonicalOrderCode(order)
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

  let authUserId = data?.user?.id ?? null
  // Only what THIS call created may be rolled back below.
  let created = Boolean(authUserId)

  if (error || !authUserId) {
    // Supabase answers "already been registered" for a taken alias.
    const taken = error?.message?.toLowerCase().includes("already")
    if (!taken) {
      console.error("[signup] createUser failed", error)
      await recordAttempt(ip, null, false)
      return { error: e.signupFailed }
    }

    // The alias may be the corpse of a signup that died before it linked a
    // customers row — see 0009_orphan_signup.sql for why adopting it is safe.
    // A real account always has that row, and still gets phoneTaken.
    const { data: orphanId, error: orphanError } = await admin.rpc(
      "find_orphan_auth_user",
      { p_email: email },
    )
    if (orphanError) console.error("[signup] orphan lookup failed", orphanError)
    if (!orphanId) {
      await recordAttempt(ip, null, false)
      return { error: e.phoneTaken }
    }

    const { error: adoptError } = await admin.auth.admin.updateUserById(
      orphanId as string,
      {
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: { phone },
      },
    )
    if (adoptError) {
      console.error("[signup] orphan adoption failed", orphanId, adoptError)
      await recordAttempt(ip, null, false)
      return { error: e.signupFailed }
    }

    console.info("[signup] adopted orphaned auth user", orphanId)
    authUserId = orphanId as string
    created = false
  }

  // Carries over points credited against this phone before signup (a webhook can
  // have created the row already).
  const linked = await linkAuthUserToPhone(authUserId, phone)
  if (!linked.ok) {
    // Roll the account back rather than leaving a login with no points behind it.
    if (created) await admin.auth.admin.deleteUser(authUserId)
    return { error: e.phoneTaken }
  }

  // Claim the proof order. Deliberately best-effort from here down: the account
  // exists, so nothing below may turn a completed signup into an error.
  //
  // claim_points does NOT check the order status (the old /claim action did), so
  // the settled-status gate is applied here. An unsettled order still proves
  // ownership; the webhook credits it once it reaches a claimable status.
  const settings = await getActiveSettings()
  if (settings?.claimable_statuses.includes(order.status)) {
    const { error: claimError } = await admin.rpc("claim_points", {
      p_order_code: orderCode,
      p_phone: phone,
      p_full_name: fullName,
      p_email: null,
      p_pancake_customer_id: pancakeCustomerId,
      p_items: toRpcItems(order),
      p_source: "claim",
      // The proof order counts towards the tier ladder like any other.
      p_order_total: orderSpendTotal(order),
    })
    // P0002 = already claimed. Either way the account keeps its link below.
    if (claimError) {
      console.warn("[signup] claim skipped", orderCode, claimError.code)
    }
  }

  // Unconditional: the claim above may have been skipped, and the link is what
  // the webhook attributes every FUTURE order by.
  await linkPancakeCustomer(linked.customer.id, pancakeCustomerId)

  // Name + DOB. Same RPC the profile screen uses; the pet fields are empty at
  // signup, so passing null blanks nothing.
  const { error: profileError } = await admin.rpc("update_customer_profile", {
    p_customer_id: linked.customer.id,
    p_full_name: fullName,
    p_dob: parsed.data.date_of_birth,
    p_pet_name: null,
    p_pet_type: null,
    p_pet_dob: null,
  })
  if (profileError) console.warn("[signup] profile save failed", profileError)

  // Fill in the real name and phone on the POS record, but only where Pancake
  // has nothing but a mask — it skips entirely when the shop already knows both.
  try {
    const synced = await updateCustomer(pancakeCustomerId, {
      name: fullName,
      phone,
    })
    console.info(`[signup] pancake sync ${synced}`, pancakeCustomerId)
  } catch (err) {
    console.error("[signup] pancake customer sync failed", pancakeCustomerId, err)
  }

  await recordAttempt(ip, orderCode, true)

  // Seed the theme from the new member's age (>= 30 -> light). Fresh account, so
  // there is no prior choice to preserve.
  await setThemeCookie(themeForDob(parsed.data.date_of_birth))

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
