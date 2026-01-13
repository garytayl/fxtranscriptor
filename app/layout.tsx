import type React from "react"
import type { Metadata } from "next"
import { IBM_Plex_Sans, IBM_Plex_Mono, Bebas_Neue } from "next/font/google"
import { SmoothScroll } from "@/components/smooth-scroll"
import { Toaster } from "@/components/ui/toast"
import { ErrorBoundary } from "@/components/error-boundary"
import "./globals.css"

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
})
const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
})
const bebasNeue = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" })

export const metadata: Metadata = {
  title: {
    default: "FX Archive — Sermon Transcript Archive",
    template: "%s | FX Archive",
  },
  description: "Sermon transcript archive for FX Church (Foot of the Cross). Automatically syncs from Podbean and YouTube with one-click transcript generation.",
  keywords: ["sermons", "transcripts", "FX Church", "Foot of the Cross", "podcast", "audio", "transcription"],
  authors: [{ name: "FX Church" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "FX Archive",
    title: "FX Archive — Sermon Transcript Archive",
    description: "Sermon transcript archive for FX Church. Automatically syncs from Podbean and YouTube with one-click transcript generation.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FX Archive — Sermon Transcript Archive",
    description: "Sermon transcript archive for FX Church. Automatically syncs from Podbean and YouTube with one-click transcript generation.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background">
      <body
        className={`${ibmPlexSans.variable} ${bebasNeue.variable} ${ibmPlexMono.variable} font-sans antialiased overflow-x-hidden`}
      >
        <ErrorBoundary>
          <div className="noise-overlay" aria-hidden="true" />
          <SmoothScroll>{children}</SmoothScroll>
          <Toaster position="top-right" richColors closeButton />
        </ErrorBoundary>
      </body>
    </html>
  )
}
