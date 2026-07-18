import { ClaimForm } from "./claim-form"

export const metadata = {
  title: "Claim Loyalty Points",
}

export default function ClaimPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <ClaimForm />
    </main>
  )
}
