import { AuthSplit } from "@/components/auth-split"
import { LoginForm } from "./login-form"
import { getMessages } from "@/lib/i18n/server"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.admin.login.metaTitle }
}

export default async function LoginPage() {
  const t = await getMessages()
  const l = t.admin.login
  return (
    // The same split the customer's sign-in uses: both portals are one product,
    // and this card was the last screen still on its own layout.
    <AuthSplit
      brand={t.admin.nav.brand}
      headline={l.panelTitle}
      tagline={l.panelBody}
    >
      <div>
        <div className="mb-8 grid gap-2 text-center">
          <h1 className="text-headline-lg">{l.title}</h1>
          <p className="text-body-lg text-muted-foreground">{l.description}</p>
        </div>
        <LoginForm />
      </div>
    </AuthSplit>
  )
}
