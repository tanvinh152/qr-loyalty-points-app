"use server"

import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import { matchesOrderPhones, normalizePhone } from "@/lib/phone"
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit"
import {
  canonicalOrderCode,
  getOrder,
  orderPhoneCandidates,
  orderSpendTotal,
  toRpcItems,
  updateCustomer,
} from "@/lib/pancake/client"
import { PancakeRequestError } from "@/lib/pancake/types"
import {
  getActiveSettings,
  getCustomerByAuthUserId,
  getCustomerByPancakeId,
  getCustomerByPhone,
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

// Customer accounts are phone + password — no SMS provider, no OTP cost.
// Supabase Auth's password provider is email-keyed, so signup collects the
// member's REAL address and sign-in resolves the phone to it through
// `customers.email`; the phone is the lookup key, never the credential Supabase
// sees. (It used to be a synthetic `<phone>@…` alias — see 0014 for the switch.)
// Signup still goes through the admin API so no confirmation mail is queued:
// this project sends none, and `email_confirm: true` is what keeps that true
// however the project's email settings are configured.
//
// Registration is also the LINKING step: it demands a recent order code, proves
// the phone against that order's masked number, claims the order's points, and
// stores `pancake_customer_id` so every later order is credited automatically by
// the webhook. There is no manual claim screen any more.

export type AuthState = { error: string } | null

// Supabase reports a duplicate address as `email_exists`; older releases only
// said "…has already been registered".
function isEmailTaken(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  return (
    error.code === "email_exists" ||
    Boolean(error.message?.toLowerCase().includes("already"))
  )
}

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

  // The form asks for a phone; Supabase wants the address that phone registered
  // with. An unknown phone is answered with the SAME generic message as a wrong
  // password, and from behind the same rate limiter, so this lookup cannot be
  // used to ask whether a number is a member.
  const customer = await getCustomerByPhone(parsed.data.phone)
  if (!customer?.email) {
    await recordAttempt(ip, null, false)
    return { error: e.invalidCredentials }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: customer.email,
    password: parsed.data.password,
  })

  if (error) {
    // Sign-in carries no order code, so this counts against the IP budget only.
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
    email: String(formData.get("email") ?? ""),
    full_name: String(formData.get("full_name") ?? ""),
    date_of_birth: String(formData.get("date_of_birth") ?? ""),
    terms: formData.get("terms") === "on" || formData.get("terms") === "true",
    order_code: String(formData.get("order_code") ?? ""),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? e.signupFailed }
  }

  const typedCode = parsed.data.order_code

  // Both budgets, not just the IP one: order codes are partly sequential
  // (Pancake system_id), so a guesser spread across addresses is throttled by
  // the code they keep hammering.
  const ip = await getClientIp()
  if (await isRateLimited(ip, typedCode)) return { error: e.rateLimited }

  const phone = normalizePhone(parsed.data.phone)
  const fullName = parsed.data.full_name

  // Everything that can legitimately reject the signup happens BEFORE the auth
  // user exists, so a business failure leaves nothing behind to roll back.
  let order
  try {
    order = await getOrder(typedCode)
  } catch (err) {
    // Only a genuine "no such order" is the customer's mistake. A bad API key or
    // a Pancake outage looks identical to them, and charging it to their five
    // attempts locks out a real member over our own misconfiguration.
    if (err instanceof PancakeRequestError && err.kind !== "not_found") {
      console.error("[signup] pancake unavailable", err.kind, err)
      return { error: e.serviceUnavailable }
    }
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
  //
  // A DB error here must NOT read as "nobody is linked": that is the gate
  // failing open. Stop instead, and do not charge the attempt — the customer did
  // nothing wrong.
  let alreadyLinked
  try {
    alreadyLinked = await getCustomerByPancakeId(pancakeCustomerId)
  } catch (err) {
    console.error("[signup] link lookup failed", pancakeCustomerId, err)
    return { error: e.serviceUnavailable }
  }
  if (alreadyLinked && alreadyLinked.phone !== phone) {
    await recordAttempt(ip, typedCode, false)
    return { error: e.orderAlreadyLinked }
  }

  const orderCode = canonicalOrderCode(order)
  const email = parsed.data.email

  const admin = createAdminClient()

  // A signup that died between createUser and linkAuthUserToPhone leaves an auth
  // user with no customers row; without a way to adopt it the member could never
  // register again — see 0009_orphan_signup.sql for why adopting it is safe (a
  // real account ALWAYS has that row).
  //
  // Asked BEFORE anything is created, and keyed by PHONE rather than by address
  // (0014): the member retrying may well be fixing a typo in the email they gave
  // last time, and the phone is what the order code above just proved.
  const { data: orphanId, error: orphanError } = await admin.rpc(
    "find_orphan_auth_user",
    { p_phone: phone },
  )
  if (orphanError) console.error("[signup] orphan lookup failed", orphanError)

  let authUserId: string | null = null
  // Only what THIS action created may be rolled back below.
  let created = false

  if (orphanId) {
    const { error: adoptError } = await admin.auth.admin.updateUserById(
      orphanId as string,
      {
        email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: { phone },
      },
    )
    if (adoptError) {
      // The corpse is provably this phone's, so the only thing that can be taken
      // here is the address the member just typed.
      console.error("[signup] orphan adoption failed", orphanId, adoptError)
      await recordAttempt(ip, typedCode, false)
      return {
        error: isEmailTaken(adoptError) ? e.emailTaken : e.signupFailed,
      }
    }

    console.info("[signup] adopted orphaned auth user", orphanId)
    authUserId = orphanId as string
  } else {
    // Created with the admin API rather than auth.signUp() on purpose: the public
    // endpoint queues a confirmation mail, and this project sends none.
    // admin.createUser marks the address confirmed instead, so signup works no
    // matter how the project's email settings are configured. Nothing here sets
    // app_metadata — customers must never carry the admin role claim (see
    // is_admin() in 0005).
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { phone },
    })

    authUserId = data?.user?.id ?? null
    created = Boolean(authUserId)

    if (error || !authUserId) {
      // "Already registered" no longer means "this phone is taken": the phone had
      // no auth user at all, or the lookup above would have adopted it. It means
      // the EMAIL belongs to somebody else. Phone collisions are caught below by
      // linkAuthUserToPhone, which owns that check because `customers.phone` is
      // the unique column.
      const taken = isEmailTaken(error)
      if (!taken) console.error("[signup] createUser failed", error)
      await recordAttempt(ip, typedCode, false)
      return { error: taken ? e.emailTaken : e.signupFailed }
    }
  }

  // Carries over points credited against this phone before signup (a webhook can
  // have created the row already).
  const linked = await linkAuthUserToPhone(authUserId, phone, email)
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
      p_email: email,
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
  //
  // This is the one "best-effort" step that is not optional. Without the link
  // the account is invisible to the webhook forever, so a failure here has to
  // end the signup rather than hand back a working login that never earns.
  const link = await linkPancakeCustomer(linked.customer.id, pancakeCustomerId)
  if (!link.ok) {
    // `conflict` means another signup won the race for this POS customer between
    // the gate above and here — the unique index caught what the gate could not.
    if (created) await admin.auth.admin.deleteUser(authUserId)
    await recordAttempt(ip, typedCode, false)
    return {
      error:
        link.reason === "error" ? e.serviceUnavailable : e.orderAlreadyLinked,
    }
  }

  // One-time signup bonus, amount set by the admin (0018). Best-effort like
  // everything below the link: the account and its point-earning are already
  // real, so a failure here must not turn a completed signup into an error.
  const { error: giftError } = await admin.rpc("grant_welcome_gift", {
    p_customer_id: linked.customer.id,
  })
  if (giftError) console.warn("[signup] welcome gift skipped", giftError)

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
