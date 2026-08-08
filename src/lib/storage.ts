import "server-only"

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MEDIA_BUCKET,
  mediaObjectPath,
  mediaPath,
  type MediaFolder,
} from "@/lib/media"
import { createAdminClient } from "@/lib/supabase/admin"

// The only code that talks to the `media` bucket. The bucket's shape and the
// pure key/URL helpers live in src/lib/media.ts, which the browser also imports.

/** `reason` is a code, not a message — the caller owns the i18n. */
export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; reason: "type" | "size" | "failed" }

/** Validates, stores, and answers with the public URL. */
export async function uploadImage(
  folder: MediaFolder,
  file: File,
): Promise<UploadResult> {
  // The browser checks first for a fast error; this is the check that counts.
  if (!ALLOWED_IMAGE_TYPES[file.type]) return { ok: false, reason: "type" }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "size" }
  }

  const path = mediaPath(folder, file.type)
  const storage = createAdminClient().storage.from(MEDIA_BUCKET)

  const { error } = await storage.upload(path, file, {
    contentType: file.type,
    // Immutable in practice — the key contains a uuid, so a changed image is a
    // new object and never a stale cache entry.
    cacheControl: "31536000",
  })
  if (error) return { ok: false, reason: "failed" }

  return { ok: true, url: storage.getPublicUrl(path).data.publicUrl }
}

/**
 * Best-effort orphan cleanup. Never throws and never reports: a reward row that
 * saved or deleted successfully must not be announced as a failure because the
 * old picture outlived it.
 */
export async function deleteImageByUrl(
  url: string | null | undefined,
): Promise<void> {
  const path = mediaObjectPath(url)
  if (!path) return

  try {
    await createAdminClient().storage.from(MEDIA_BUCKET).remove([path])
  } catch {
    // swallowed on purpose — see above.
  }
}
