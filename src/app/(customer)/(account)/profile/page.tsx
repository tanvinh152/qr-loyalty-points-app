import Image from "next/image"
import Link from "next/link"
import { HelpCircle, LogOut, Sparkles } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/server"
import { signOut } from "../../auth/actions"
import { getAccount } from "../account"
import { ProfileForm } from "./profile-form"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.profile.metaTitle }
}

export default async function ProfilePage() {
  const t = await getMessages()
  const p = t.customer.profile
  const { customer } = await getAccount()
  if (!customer) return null

  return (
    <div className="border-border bg-card grid overflow-hidden rounded-3xl border lg:grid-cols-2">
      {/* The photo half, as in the mockup. It stays visible on phones, stacked
          above the form — same treatment as `AuthSplit`. */}
      <aside className="bg-surface-low relative isolate grid min-h-[200px] content-end gap-4 p-4 sm:min-h-[300px] sm:p-6 md:p-12">
        {/* Decorative: the copy beside it carries the meaning. */}
        <Image
          src="/profile-hero.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="-z-10 object-cover"
        />
        {/* Only enough scrim to keep the copy legible — the mockup lets the
            photo read clearly above the text. */}
        <div
          aria-hidden
          className="from-background via-background/60 -z-10 absolute inset-0 bg-gradient-to-t to-transparent"
        />

        <div className="grid max-w-md gap-4">
          <h2 className="text-headline-lg text-primary sm:text-display">
            {p.panelTitle}
          </h2>
          <p className="text-body-lg text-muted-foreground">{p.panelBody}</p>
        </div>
      </aside>

      {/* The mockup puts the page title inside the form column, not above the
          card, and the order-code callout inside the form itself. */}
      <div className="grid gap-6 p-4 sm:gap-8 sm:p-6 md:p-12">
        <div className="flex items-center gap-3">
          <Sparkles
            className="text-primary size-7 shrink-0 sm:size-8"
            aria-hidden
          />
          {/* "Set up" only holds the first time — after that the screen is
              where an existing profile is edited. */}
          <h1 className="text-headline-lg">
            {customer.profile_completed_at ? p.titleEdit : p.title}
          </h1>
        </div>
        <ProfileForm customer={customer} />

        {/* Shown at EVERY width. The rail used to carry these on a desktop, but
            the nav is now the mockups' four items, so the rail has only the
            upgrade CTA and sign-out left. /profile is the avatar's destination
            at both widths, which makes it the natural home for account settings. */}
        <section className="border-border grid gap-1 border-t pt-6">
          <h2 className="text-label-md text-muted-foreground mb-2 uppercase">
            {p.settingsSection}
          </h2>
          <ThemeToggle />
          <Link
            href="/help"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-full justify-start",
            )}
          >
            <HelpCircle className="size-4" aria-hidden />
            {t.customer.nav.help}
          </Link>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
            >
              <LogOut className="size-4" aria-hidden />
              {t.customer.nav.signOut}
            </Button>
          </form>
        </section>
      </div>
    </div>
  )
}
