import { beforeEach, describe, expect, it, vi } from "vitest"

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co"

// The service-role client bypasses RLS, so what matters here is that a bad file
// is refused BEFORE it is ever handed over.
type StorageError = { message: string } | null
const upload = vi.fn(
  async (
    path: string,
    file: File,
    options?: Record<string, unknown>,
  ): Promise<{ error: StorageError }> => {
    void path
    void file
    void options
    return { error: null }
  },
)
const remove = vi.fn(
  async (paths: string[]): Promise<{ error: StorageError }> => {
    void paths
    return { error: null }
  },
)
const getPublicUrl = vi.fn((path: string) => ({
  data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/media/${path}` },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ upload, remove, getPublicUrl }) },
  }),
}))

const { deleteImageByUrl, uploadImage } = await import("./storage")

const PUBLIC = "https://project.supabase.co/storage/v1/object/public/media"

function fakeFile(type: string, size: number) {
  return { type, size } as unknown as File
}

describe("uploadImage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("stores an allowed image and answers with its public URL", async () => {
    const result = await uploadImage("rewards", fakeFile("image/png", 1024))
    expect(result).toEqual({
      ok: true,
      url: expect.stringMatching(
        /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/media\/rewards\/[0-9a-f-]{36}\.png$/,
      ),
    })
    expect(upload).toHaveBeenCalledOnce()
    // The content type is pinned, so the object cannot be served as something
    // else later.
    expect(upload.mock.calls[0][2]).toMatchObject({ contentType: "image/png" })
  })

  it("refuses a disallowed type without touching storage", async () => {
    // The browser pre-check is a courtesy; a direct POST skips it entirely.
    await expect(
      uploadImage("rewards", fakeFile("image/svg+xml", 100)),
    ).resolves.toEqual({ ok: false, reason: "type" })
    expect(upload).not.toHaveBeenCalled()
  })

  it("refuses an oversized file without touching storage", async () => {
    await expect(
      uploadImage("rewards", fakeFile("image/jpeg", 5 * 1024 * 1024 + 1)),
    ).resolves.toEqual({ ok: false, reason: "size" })
    expect(upload).not.toHaveBeenCalled()
  })

  it("refuses an empty file", async () => {
    await expect(
      uploadImage("rewards", fakeFile("image/jpeg", 0)),
    ).resolves.toEqual({ ok: false, reason: "size" })
    expect(upload).not.toHaveBeenCalled()
  })

  it("reports a storage error as a plain failure", async () => {
    upload.mockResolvedValueOnce({ error: { message: "boom" } })
    await expect(
      uploadImage("rewards", fakeFile("image/webp", 2048)),
    ).resolves.toEqual({ ok: false, reason: "failed" })
  })
})

describe("deleteImageByUrl", () => {
  beforeEach(() => vi.clearAllMocks())

  it("removes one of our objects", async () => {
    await deleteImageByUrl(`${PUBLIC}/rewards/abc.jpg`)
    expect(remove).toHaveBeenCalledWith(["rewards/abc.jpg"])
  })

  it("leaves an externally hosted image alone", async () => {
    await deleteImageByUrl("https://images.example.com/cat.jpg")
    expect(remove).not.toHaveBeenCalled()
  })

  it("does nothing when there is no image", async () => {
    await deleteImageByUrl(null)
    expect(remove).not.toHaveBeenCalled()
  })

  // A reward that saved must not be reported as failed because its old picture
  // outlived it.
  it("swallows a storage failure", async () => {
    remove.mockRejectedValueOnce(new Error("network"))
    await expect(
      deleteImageByUrl(`${PUBLIC}/rewards/abc.jpg`),
    ).resolves.toBeUndefined()
  })
})
