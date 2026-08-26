import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getLocale, getMessages } from "@/lib/i18n/server"
import { I18nProvider } from "@/lib/i18n/provider"
import { getTheme } from "@/lib/theme/server"
import { ThemeProvider } from "@/lib/theme/provider"
import { ThemeInitScript } from "@/lib/theme/theme-init-script"

// The Azure Paw mockups' typeface. "vietnamese" is not optional here — vi is
// the default locale. Plus Jakarta Sans is variable (200-800), so the mockups'
// 400/600/700/800 all resolve without declaring separate weights.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "vietnamese"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// `viewportFit: "cover"` is the switch that makes env(safe-area-inset-*) resolve
// to anything other than 0 — the phone tab bar is fixed to the bottom edge and
// would otherwise sit under the home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

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
  const theme = await getTheme()
  return (
    <html
      lang={locale}
      // Set only when we know it (explicit choice or age-seed). When null the
      // ThemeInitScript below resolves it from the OS before paint.
      data-theme={theme ?? undefined}
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {theme === null && <ThemeInitScript />}
        <I18nProvider locale={locale}>
          <ThemeProvider initial={theme}>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </I18nProvider>
        <Toaster richColors />
      </body>
    </html>
  )
}
