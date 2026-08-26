import { getMessages } from "@/lib/i18n/server"
import { AuthSplit } from "@/components/auth-split"
import { AuthTabs } from "@/components/auth-tabs"
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
      brand={t.brand.name}
      headline={l.panelTitle}
      tagline={l.panelBody}
      benefits={l.benefits}
      tabs={<AuthTabs active="login" />}
    >
      {/* No heading and no "don't have an account?" line: the tab strip above
          names this page AND carries the route to the other one, so both would
          be the same signpost twice. The h1 for the route lives in the strip's
          current tab. */}
      <LoginForm />
    </AuthSplit>
  )
}
