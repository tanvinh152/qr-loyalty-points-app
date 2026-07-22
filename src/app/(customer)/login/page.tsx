import Link from "next/link"

import { getMessages } from "@/lib/i18n/server"
import { AuthSplit } from "@/components/auth-split"
import { LoginForm } from "./login-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.login.metaTitle }
}

export default async function CustomerLoginPage() {
  const t = await getMessages()
  const l = t.customer.login

  return (
    <AuthSplit
      brand={t.claim.brand.name}
      headline={l.panelTitle}
      tagline={l.panelBody}
    >
      {/* No card here: the form sits directly on the split's right half. */}
      <div>
        <div className="mb-8 grid gap-2 text-center">
          <h1 className="text-headline-lg">{l.title}</h1>
          <p className="text-body-lg text-muted-foreground">{l.subtitle}</p>
        </div>

        <LoginForm />

        <p className="text-body-sm text-muted-foreground mt-6 text-center">
          {l.noAccount}{" "}
          <Link
            href="/register"
            className="text-secondary font-semibold hover:underline"
          >
            {l.registerCta}
          </Link>
        </p>
      </div>
    </AuthSplit>
  )
}
