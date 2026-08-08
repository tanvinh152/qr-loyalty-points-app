import { beforeAll, describe, expect, it } from "vitest"

const BASE = "https://project.supabase.co"

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE
})

const { ALLOWED_IMAGE_TYPES, mediaObjectPath, mediaPath } = await import(
  "./media"
)

const PUBLIC = `${BASE}/storage/v1/object/public/media`

// The stored key is the only thing standing between an upload and what this
// origin later serves it as, so where each half of it comes from matters.
describe("mediaPath", () => {
  it("takes the extension from the mime type, never from the filename", () => {
    // A caller claiming "evil.html" still gets a .png: the name is theirs, the
    // content type was validated.
    const path = mediaPath("rewards", "image/png")
    expect(path).toMatch(/^rewards\/[0-9a-f-]{36}\.png$/)
  })

  it("gives every upload a fresh key, so none can overwrite another", () => {
    const a = mediaPath("rewards", "image/jpeg")
    const b = mediaPath("rewards", "image/jpeg")
    expect(a).not.toBe(b)
  })

  it("covers every mime the bucket allows", () => {
    for (const [mime, ext] of Object.entries(ALLOWED_IMAGE_TYPES)) {
      expect(mediaPath("blog", mime).endsWith(`.${ext}`)).toBe(true)
    }
  })

  it("refuses a mime the bucket does not allow", () => {
    expect(() => mediaPath("rewards", "image/svg+xml")).toThrow()
    expect(() => mediaPath("rewards", "text/html")).toThrow()
  })

  // The folder arrives from the browser, so it is an allowlist and not a regex.
  it("refuses a folder outside the allowlist", () => {
    expect(() => mediaPath("../../etc", "image/png")).toThrow()
    expect(() => mediaPath("avatars", "image/png")).toThrow()
    expect(() => mediaPath("", "image/png")).toThrow()
  })
})

// This decides what `deleteImageByUrl` is allowed to remove. A false positive
// here deletes someone else's picture; a false negative only leaks an orphan.
describe("mediaObjectPath", () => {
  it("extracts the key from one of our public URLs", () => {
    expect(mediaObjectPath(`${PUBLIC}/rewards/abc.jpg`)).toBe("rewards/abc.jpg")
  })

  it("drops a query string and a fragment", () => {
    expect(mediaObjectPath(`${PUBLIC}/rewards/abc.jpg?v=2`)).toBe(
      "rewards/abc.jpg",
    )
    expect(mediaObjectPath(`${PUBLIC}/rewards/abc.jpg#top`)).toBe(
      "rewards/abc.jpg",
    )
  })

  it("decodes a percent-escaped key", () => {
    expect(mediaObjectPath(`${PUBLIC}/rewards/a%20b.jpg`)).toBe(
      "rewards/a b.jpg",
    )
  })

  it("returns null for an externally hosted image", () => {
    // The pasted-URL field still exists, and those images are not ours to bin.
    expect(mediaObjectPath("https://images.example.com/cat.jpg")).toBeNull()
    expect(mediaObjectPath("https://content.pancake.vn/x.jpg")).toBeNull()
  })

  it("returns null for another bucket on the same project", () => {
    expect(
      mediaObjectPath(`${BASE}/storage/v1/object/public/avatars/me.jpg`),
    ).toBeNull()
  })

  it("returns null for an empty, absent or key-less URL", () => {
    expect(mediaObjectPath(null)).toBeNull()
    expect(mediaObjectPath(undefined)).toBeNull()
    expect(mediaObjectPath("")).toBeNull()
    expect(mediaObjectPath(`${PUBLIC}/`)).toBeNull()
  })

  it("returns null for a key that walks out of its folder", () => {
    expect(mediaObjectPath(`${PUBLIC}/../../secret.jpg`)).toBeNull()
  })

  it("returns null for a malformed escape rather than throwing", () => {
    expect(mediaObjectPath(`${PUBLIC}/rewards/%E0%A4%A.jpg`)).toBeNull()
  })
})
