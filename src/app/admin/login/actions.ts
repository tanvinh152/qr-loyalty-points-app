"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/i18n/server"
import {
  getClientIp,
  isLoginRateLimited,
  recordLoginAttempt,
} from "@/lib/rate-limit"

export type LoginState = { error: string } | null

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const t = await getMessages()
  const l = t.admin.login

  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!email || !password) return { error: l.required }

  const ip = await getClientIp()
  if (await isLoginRateLimited(ip)) return { error: l.rateLimited }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  await recordLoginAttempt(ip, !error)

  if (error) return { error: l.invalidCredentials }

  redirect("/admin")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/admin/login")
}
