// Shape of the `media` bucket (0015_media_storage.sql), and the pure helpers for
// its keys and URLs. Deliberately free of `server-only` and of any Supabase
// import: the uploader in src/components/image-upload.tsx pre-checks a file in
// the browser against the same limits the server enforces, and a second copy of
// these constants would be a second thing to keep in sync.
//
// Everything that TALKS to storage lives in src/lib/storage.ts, which is
// server-only.

export const MEDIA_BUCKET = "media"

/**
 * Mirrors the bucket's `allowed_mime_types`; the value is the extension the
 * stored object gets. SVG is absent on purpose — it can carry script and these
 * files are served from the app's own origin.
 */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

/** For the file picker's `accept`. */
export const IMAGE_ACCEPT = Object.keys(ALLOWED_IMAGE_TYPES).join(",")

/** Mirrors the bucket's `file_size_limit`. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024))

/**
 * One folder per feature. This is an allowlist rather than a pattern because the
 * folder arrives from the browser: a caller that could name its own prefix could
 * scatter objects anywhere in the bucket.
 */
export const MEDIA_FOLDERS = ["rewards", "blog", "spin"] as const
export type MediaFolder = (typeof MEDIA_FOLDERS)[number]

export function isMediaFolder(value: unknown): value is MediaFolder {
  return (
    typeof value === "string" &&
    (MEDIA_FOLDERS as readonly string[]).includes(value)
  )
}

/**
 * The stored object's key.
 *
 * The extension comes from the *validated mime type*, never from the uploaded
 * filename: the name is attacker-controlled, and a `.html` or `.svg` payload
 * that got to keep its own extension would be served from this origin with that
 * content type. The basename is a fresh uuid for the same reason — an upload can
 * then never overwrite an existing object, whatever it claims to be called.
 */
export function mediaPath(folder: string, mime: string): string {
  const ext = ALLOWED_IMAGE_TYPES[mime]
  if (!ext) throw new Error(`unsupported image type: ${mime}`)
  if (!isMediaFolder(folder)) throw new Error(`unknown media folder: ${folder}`)
  return `${folder}/${crypto.randomUUID()}.${ext}`
}

function publicPrefix(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "")
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/`
}

/**
 * The object key behind one of our public URLs, or null for anything else.
 *
 * Null is the answer that matters: `image_url` may still hold a link the admin
 * pasted by hand, and an external URL must never be mistaken for an object this
 * app is entitled to delete.
 */
export function mediaObjectPath(url: string | null | undefined): string | null {
  if (!url) return null
  const prefix = publicPrefix()
  if (!url.startsWith(prefix)) return null

  const [raw] = url.slice(prefix.length).split(/[?#]/)
  let path: string
  try {
    path = decodeURIComponent(raw)
  } catch {
    return null
  }
  // `from(MEDIA_BUCKET)` already scopes the delete, but a key that walks out of
  // its folder is malformed either way.
  if (!path || path.includes("..")) return null
  return path
}
