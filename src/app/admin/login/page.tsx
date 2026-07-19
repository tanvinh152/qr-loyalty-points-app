import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{l.title}</CardTitle>
          <CardDescription>{l.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
