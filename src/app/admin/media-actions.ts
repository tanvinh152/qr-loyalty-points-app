"use server"

import { getMessages } from "@/lib/i18n/server"
import { isMediaFolder, MAX_IMAGE_MB } from "@/lib/media"
import { uploadImage } from "@/lib/storage"
import { createClient } from "@/lib/supabase/server"

export type UploadState =
  | { ok: true; url: string }
  | { ok: false; message: string }

/**
 * Stores one image in the `media` bucket and answers with its public URL.
 *
 * It lives at the /admin level rather than under a single feature because the
 * reward dialog and, later, the blog editor both post to it.
 *
 * The admin check is load-bearing, not decoration. Every other admin write in
 * this app goes through the cookie-scoped client, so RLS refuses a stranger even
 * if the request reaches the action; this one hands the file to the service-role
 * client, which bypasses the bucket's policies entirely. A Server Action is a
 * public POST endpoint, so the /admin guard in src/lib/supabase/middleware.ts
 * cannot be the only thing in front of it.
 */
export async function uploadMedia(formData: FormData): Promise<UploadState> {
  const t = await getMessages()
  const m = t.admin.media

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The same claim public.is_admin() reads. app_metadata is service-role
  // writable only, so it cannot be self-assigned.
  if (user?.app_metadata?.role !== "admin") {
    return { ok: false, message: m.uploadFailed }
  }

  const folder = formData.get("folder")
  if (!isMediaFolder(folder)) return { ok: false, message: m.uploadFailed }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: m.uploadFailed }
  }

  const result = await uploadImage(folder, file)
  if (result.ok) return result

  switch (result.reason) {
    case "type":
      return { ok: false, message: m.wrongType }
    case "size":
      return { ok: false, message: m.tooLarge(MAX_IMAGE_MB) }
    default:
      return { ok: false, message: m.uploadFailed }
  }
}
