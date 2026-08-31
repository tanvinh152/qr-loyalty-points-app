"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  getCustomerByAuthUserId,
  getSpinDailyLimit,
  getSpinHistory,
  getSpinPrizes,
  getSpinsUsedToday,
} from "@/lib/loyalty"
import { getLocale, getMessages } from "@/lib/i18n/server"
import type { SpinPrizeType, SpinResult } from "@/lib/db-types"
import type { WheelSlice } from "./wheel"

// This folder holds NO page. The wheel is a modal opened from the header pill
// (`SpinDialog`), so there is no /spin route to render, revalidate or guard at
// the edge — everything the modal needs comes from `loadSpinBoard` below, on
// open. The files still live here because that is where the app keeps its
// server actions.

// The wheel is drawn INSIDE the spin_wheel RPC (0022), service_role-only like
// claim_points and redeem_reward. The browser sends nothing but the click: the
// session proves whose balance moves, the RPC picks the prize and enforces the
// daily limit, and the animation merely spins to the answer it already gave.
//
// Nothing here re-checks the limit before calling. A pre-flight count would
// only be a second, racier copy of the check the RPC already holds a row lock
// for — P0002 is the authority.

export type SpinErrorCode =
  | "session_expired"
  | "no_customer"
  | "no_spins_left"
  | "unavailable"
  | "spin_failed"

export type SpinActionResult =
  | { ok: true; result: SpinResult }
  | { ok: false; code: SpinErrorCode; error: string }

function codeFor(pgCode: string | undefined): SpinErrorCode {
  if (pgCode === "P0002") return "no_spins_left"
  // P0004 covers both "no active settings" and "nothing left to draw"; P0005 is
  // the admin switching the wheel off. All three read the same to a member.
  if (pgCode === "P0004" || pgCode === "P0005") return "unavailable"
  return "spin_failed"
}

export async function spin(): Promise<SpinActionResult> {
  const e = (await getMessages()).customer.errors

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, code: "session_expired", error: e.sessionExpired }
  }

  const customer = await getCustomerByAuthUserId(user.id)
  if (!customer) {
    return { ok: false, code: "no_customer", error: e.noCustomer }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("spin_wheel", {
    p_customer_id: customer.id,
  })

  if (error) {
    const code = codeFor(error.code)
    const byCode: Record<SpinErrorCode, string> = {
      session_expired: e.sessionExpired,
      no_customer: e.noCustomer,
      no_spins_left: e.noSpinsLeft,
      unavailable: e.spinUnavailable,
      spin_failed: e.spinFailed,
    }
    return { ok: false, code, error: byCode[code] }
  }

  // The wheel itself is not revalidated here, and could not be: it is a modal
  // fed by `loadSpinBoard`, which the dialog re-runs once the animation has
  // STOPPED. Refreshing mid-spin would drop a just-sold-out wedge out from
  // under the turn in progress.
  revalidatePath("/dashboard")
  revalidatePath("/history")

  return { ok: true, result: data as SpinResult }
}

/** How many past wins the modal lists. The page it replaced showed ten; a
 *  dialog is not a place to scroll a long list. */
const HISTORY_COUNT = 5

/** One past win, already formatted: the client has no locale of its own. */
export type SpinHistoryEntry = {
  id: string
  /** The frozen copy, not a lookup — a win keeps reading the way it read. */
  prize_name: string
  prize_type: SpinPrizeType
  points_awarded: number
  wonAt: string
  /** Only a `gift` is settled by hand, so only a gift can still be waiting. */
  collected: boolean
}

export type SpinBoard =
  | {
      ok: true
      slices: WheelSlice[]
      spinsLeft: number
      history: SpinHistoryEntry[]
    }
  // `off` is the wheel being unavailable, which is a state to explain rather
  // than an error; `auth` is the session having gone while the tab sat open.
  | { ok: false; reason: "off" | "auth"; error: string }

/**
 * Everything the modal renders, read when it OPENS rather than on every page
 * load — the header pill is on every route, and the wedges and the win list are
 * only worth a query once someone actually asks for the wheel.
 *
 * A server action is a public POST endpoint, so this proves the session itself
 * exactly the way `spin()` does. Nothing here is authority for the draw: the
 * spins-left it returns is what the modal renders before the first click, and
 * `spin_wheel` still holds the row lock that decides.
 */
export async function loadSpinBoard(): Promise<SpinBoard> {
  const t = await getMessages()
  const e = t.customer.errors

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: "auth", error: e.sessionExpired }

  const customer = await getCustomerByAuthUserId(user.id)
  if (!customer) return { ok: false, reason: "auth", error: e.noCustomer }

  const [dailyLimit, prizes] = await Promise.all([
    getSpinDailyLimit(),
    getSpinPrizes(),
  ])

  // Two independent ways for the wheel to be off, and they read the same to a
  // member: the admin set the daily limit to 0, or nothing is left to draw.
  // Both are exactly the states `spin_wheel` would answer with P0005/P0004, so
  // showing a spin button here would only produce an error on the first click.
  if (dailyLimit <= 0 || prizes.length === 0) {
    return { ok: false, reason: "off", error: t.customer.spin.offBody }
  }

  const [used, history] = await Promise.all([
    getSpinsUsedToday(customer.id),
    getSpinHistory(customer.id, HISTORY_COUNT),
  ])

  const locale = await getLocale()
  const dateFormat = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" },
  )

  return {
    ok: true,
    spinsLeft: Math.max(0, dailyLimit - used),
    // Only what the wheel needs crosses to the client — a whole RewardRow would
    // ship the stock and weight of every slice to the browser for nothing.
    slices: prizes.map((prize) => ({
      id: prize.id,
      name: prize.name,
      prize_type: prize.prize_type,
    })),
    history: history.map((win) => ({
      id: win.id,
      prize_name: win.prize_name,
      prize_type: win.prize_type,
      points_awarded: win.points_awarded,
      wonAt: dateFormat.format(new Date(win.created_at)),
      collected: win.fulfilled_at !== null,
    })),
  }
}
