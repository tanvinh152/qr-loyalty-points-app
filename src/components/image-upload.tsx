"use client"

import { useRef, useTransition } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/provider"
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  type MediaFolder,
} from "@/lib/media"
import { uploadMedia } from "@/app/admin/media-actions"

/**
 * Picks a file, stores it in the `media` bucket, and hands the caller back the
 * public URL. Controlled: it owns no state of its own beyond the pending flag, so
 * it drops straight onto a react-hook-form field via `field.onChange`.
 *
 * "Remove" clears the value only — it does not delete the stored object, because
 * the surrounding dialog may still be cancelled. Orphans are collected on save
 * and on delete instead (see the rewards actions).
 *
 * The preview is a plain `<img>` for the same reason the reward cards are: the
 * field can still hold a URL the admin pasted by hand, so `next/image` would
 * need every possible host in `remotePatterns`.
 */
export function ImageUpload({
  value,
  onChange,
  folder,
}: {
  value: string
  onChange: (url: string) => void
  folder: MediaFolder
}) {
  const t = useT()
  const m = t.admin.media
  const input = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  function pick(file: File) {
    // Fails a bad pick instantly instead of after the upload; the server checks
    // the same two things and is the authority.
    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      toast.error(m.wrongType)
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(m.tooLarge(MAX_IMAGE_MB))
      return
    }

    const body = new FormData()
    body.set("file", file)
    body.set("folder", folder)

    startTransition(async () => {
      const state = await uploadMedia(body)
      if (!state.ok) {
        toast.error(state.message)
        return
      }
      onChange(state.url)
    })
  }

  return (
    <div className="grid gap-3">
      {value && (
        <div className="border-border bg-surface-container relative aspect-[4/3] w-full max-w-56 overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={m.previewAlt}
            width={224}
            height={168}
            className="size-full object-cover"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={isPending}
          onClick={() => input.current?.click()}
        >
          {isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <ImagePlus aria-hidden />
          )}
          {isPending ? m.uploading : value ? m.replace : m.upload}
        </Button>
        {value && (
          <Button
            variant="destructive"
            size="sm"
            type="button"
            disabled={isPending}
            onClick={() => onChange("")}
          >
            <Trash2 aria-hidden />
            {m.remove}
          </Button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Reset first: picking the same file twice in a row fires no change
          // event otherwise, which reads as a broken button after a failure.
          event.target.value = ""
          if (file) pick(file)
        }}
      />
    </div>
  )
}
