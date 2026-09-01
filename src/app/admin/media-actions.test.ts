import { beforeEach, describe, expect, it, vi } from "vitest"

import { keyed } from "@/test/messages"
import { adminUser, createSupabaseFake, memberUser } from "@/test/supabase"

// uploadMedia is the one admin write that hands a file to the SERVICE-ROLE
// client, which bypasses the media bucket's storage policies completely. Every
// other admin write goes through the cookie-scoped client, where RLS refuses a
// stranger even if the POST lands. So the claim check inside this action is the
// whole of its security, and these tests are what keep it there.

const server = createSupabaseFake()

vi.mock("@/lib/i18n/server", () => ({
  getMessages: async () => ({ admin: { media: keyed(["tooLarge"]) } }),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => server.client }))
vi.mock("@/lib/storage", () => ({ uploadImage: vi.fn() }))

const { uploadImage } = await import("@/lib/storage")
const { uploadMedia } = await import("./media-actions")

const upload = vi.mocked(uploadImage)

const png = (bytes = 8) =>
  new File([new Uint8Array(bytes)], "cat.png", { type: "image/png" })

function form(over: { folder?: unknown; file?: unknown } = {}) {
  const fd = new FormData()
  fd.set("folder", (over.folder ?? "rewards") as string)
  if (over.file !== null) fd.set("file", (over.file ?? png()) as File)
  return fd
}

beforeEach(() => {
  server.reset()
  upload.mockReset()
  upload.mockResolvedValue({ ok: true, url: "https://cdn.test/rewards/a.png" })
  server.user = adminUser()
})

describe("authorization", () => {
  it("refuses an anonymous caller before the file is handed over", async () => {
    server.user = null
    expect(await uploadMedia(form())).toEqual({
      ok: false,
      message: "uploadFailed",
    })
    expect(upload).not.toHaveBeenCalled()
  })

  it("refuses a signed-in member with no admin claim", async () => {
    server.user = memberUser()
    expect(await uploadMedia(form())).toEqual({
      ok: false,
      message: "uploadFailed",
    })
    expect(upload).not.toHaveBeenCalled()
  })

  it("does not accept a role planted in user_metadata", async () => {
    server.user = memberUser({ user_metadata: { role: "admin" } })
    expect(await uploadMedia(form())).toEqual({
      ok: false,
      message: "uploadFailed",
    })
    expect(upload).not.toHaveBeenCalled()
  })

  // A distinct "you are not an admin" message would turn this endpoint into a
  // free oracle for probing whether a stolen session carries the claim.
  it("answers a non-admin with the same message as a broken file", async () => {
    server.user = memberUser()
    const refused = await uploadMedia(form())

    server.user = adminUser()
    const badFolder = await uploadMedia(form({ folder: "avatars" }))

    expect(refused).toEqual(badFolder)
  })
})

describe("the folder is an allowlist, because it arrives from the browser", () => {
  it.each([["avatars"], ["../rewards"], ["rewards/../../etc"], [""], ["REWARDS"]])(
    "refuses %j",
    async (folder) => {
      expect(await uploadMedia(form({ folder }))).toEqual({
        ok: false,
        message: "uploadFailed",
      })
      expect(upload).not.toHaveBeenCalled()
    },
  )

  it("refuses a folder field that is not a string at all", async () => {
    const fd = new FormData()
    fd.set("folder", png())
    fd.set("file", png())
    expect(await uploadMedia(fd)).toEqual({ ok: false, message: "uploadFailed" })
    expect(upload).not.toHaveBeenCalled()
  })

  it.each([["rewards"], ["blog"], ["spin"], ["milestones"]])(
    "accepts the declared folder %j and passes it on validated",
    async (folder) => {
      await uploadMedia(form({ folder }))
      expect(upload).toHaveBeenCalledWith(folder, expect.any(File))
    },
  )
})

describe("the file", () => {
  it("refuses a missing file", async () => {
    expect(await uploadMedia(form({ file: null }))).toEqual({
      ok: false,
      message: "uploadFailed",
    })
    expect(upload).not.toHaveBeenCalled()
  })

  it("refuses a value that is not a File", async () => {
    const fd = new FormData()
    fd.set("folder", "rewards")
    fd.set("file", "not-a-file")
    expect(await uploadMedia(fd)).toEqual({ ok: false, message: "uploadFailed" })
    expect(upload).not.toHaveBeenCalled()
  })

  it("refuses a zero-byte file", async () => {
    expect(await uploadMedia(form({ file: png(0) }))).toEqual({
      ok: false,
      message: "uploadFailed",
    })
    expect(upload).not.toHaveBeenCalled()
  })
})

describe("what the admin is told when storage said no", () => {
  it("names a rejected MIME type", async () => {
    upload.mockResolvedValue({ ok: false, reason: "type" })
    expect(await uploadMedia(form())).toEqual({
      ok: false,
      message: "wrongType",
    })
  })

  // tooLarge is a FUNCTION message taking the size limit. Reading it as a
  // string would put "[object Function]" in front of the admin.
  it("calls the size message rather than rendering the function", async () => {
    upload.mockResolvedValue({ ok: false, reason: "size" })
    expect(await uploadMedia(form())).toEqual({
      ok: false,
      message: "tooLarge",
    })
  })

  it("falls back to the generic failure for anything else", async () => {
    upload.mockResolvedValue({ ok: false, reason: "failed" })
    expect(await uploadMedia(form())).toEqual({
      ok: false,
      message: "uploadFailed",
    })
  })

  it("returns the public URL unchanged on success", async () => {
    upload.mockResolvedValue({ ok: true, url: "https://cdn.test/spin/x.webp" })
    expect(await uploadMedia(form({ folder: "spin" }))).toEqual({
      ok: true,
      url: "https://cdn.test/spin/x.webp",
    })
  })
})
