import { ClaimForm } from "./claim-form"
import { getMessages } from "@/lib/i18n/server"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.claim.metaTitle }
}

export default function ClaimPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <ClaimForm />
    </main>
  )
}
