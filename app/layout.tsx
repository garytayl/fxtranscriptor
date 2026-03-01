import type React from "react"
import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans, JetBrains_Mono, Syne, Bebas_Neue } from "next/font/google"
import { SmoothScroll } from "@/components/smooth-scroll"
import { Toaster } from "@/components/ui/toast"
import { ErrorBoundary } from "@/components/error-boundary"
import { AnalyticsProvider } from "@/components/analytics-provider"
import { Navbar } from "@/components/navbar"
import { AddToHomeScreenPrompt } from "@/components/add-to-homescreen-prompt"
import { NotificationPrompt } from "@/components/notification-prompt"
import "./globals.css"

const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
})
const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
})
const syne = Syne({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-display",
})
const bebasNeue = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" })

export const metadata: Metadata = {
  title: {
    default: "fxarchives — Sermon Transcript Archive",
    template: "%s | fxarchives",
  },
  description: "Sermon transcript archive for fxchurch. Automatically syncs from Podbean and YouTube with one-click transcript generation.",
  keywords: ["sermons", "transcripts", "fxchurch", "podcast", "audio", "transcription"],
  authors: [{ name: "fxchurch" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "fxarchives",
    title: "fxarchives — Sermon Transcript Archive",
    description: "Sermon transcript archive for fxchurch. Automatically syncs from Podbean and YouTube with one-click transcript generation.",
  },
  twitter: {
    card: "summary_large_image",
    title: "fxarchives — Sermon Transcript Archive",
    description: "Sermon transcript archive for fxchurch. Automatically syncs from Podbean and YouTube with one-click transcript generation.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

/** Stable viewport: avoid "zoomed in on load" or after rotation; keep user zoom for a11y. */
export const viewport: Viewport = {
  width: "device-width",
  height: "device-height",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 10,
  userScalable: true,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background">
      <body
        className={`${plusJakartaSans.variable} ${syne.variable} ${jetbrainsMono.variable} ${bebasNeue.variable} font-sans antialiased overflow-x-hidden min-h-[100dvh]`}
      >
        <ErrorBoundary>
          <AnalyticsProvider>
            <div className="noise-overlay" aria-hidden="true" />
            <Navbar />
            <SmoothScroll>{children}</SmoothScroll>
            <Toaster position="top-right" richColors closeButton />
            <AddToHomeScreenPrompt />
            <NotificationPrompt />
          </AnalyticsProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
