import Link from "next/link"

import { getMessages } from "@/lib/i18n/server"
import { SIGNUP_REQUIRES_PROOF } from "@/lib/customer-auth"
import { AuthSplit } from "@/components/auth-split"
import { RegisterForm } from "./register-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.register.metaTitle }
}

export default async function CustomerRegisterPage() {
  const t = await getMessages()
  const r = t.customer.register

  return (
    <AuthSplit
      brand={t.claim.brand.name}
      headline={t.customer.login.panelTitle}
      tagline={r.brandTagline}
    >
      {/* No card here: the form sits directly on the split's right half. */}
      <div>
        <h1 className="text-headline-lg mb-8 text-center">{r.title}</h1>
        {/* The order-code proof field only exists when the server demands it. */}
        <RegisterForm requireProof={SIGNUP_REQUIRES_PROOF} />

        <p className="text-body-sm text-muted-foreground mt-6 text-center">
          {r.haveAccount}{" "}
          <Link
            href="/login"
            className="text-secondary font-semibold hover:underline"
          >
            {r.loginCta}
          </Link>
        </p>
      </div>
    </AuthSplit>
  )
}
