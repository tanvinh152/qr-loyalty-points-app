import type { Metadata } from "next"
import { Hanken_Grotesk, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { I18nProvider } from "@/lib/i18n/provider"

// "vietnamese" is not optional here — vi is the default locale.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin", "vietnamese"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages()
  return {
    title: t.meta.appTitle,
    description: t.meta.appDescription,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  return (
    <html
      lang={locale}
      className={`${hanken.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>
          <TooltipProvider>{children}</TooltipProvider>
        </I18nProvider>
        <Toaster richColors />
      </body>
    </html>
  )
}
