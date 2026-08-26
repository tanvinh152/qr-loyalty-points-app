import { getMessages } from "@/lib/i18n/server"
import { AuthSplit } from "@/components/auth-split"
import { AuthTabs } from "@/components/auth-tabs"
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
      brand={t.brand.name}
      headline={t.customer.login.panelTitle}
      tagline={r.brandTagline}
      benefits={t.customer.login.benefits}
      tabs={<AuthTabs active="register" />}
    >
      {/* Every field is mandatory: registration is what links the account to
          Pancake, so the server cannot complete it with anything missing. The
          mockup marks the order code "optional" — it cannot be: `signUp` proves
          the phone number through that order. */}
      <RegisterForm />
    </AuthSplit>
  )
}
