'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { analytics } from '@/lib/analytics'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    // Track page views (skip scripture reader for privacy-first browsing)
    if (pathname && !pathname.startsWith("/bible")) {
      analytics.pageView(pathname)
    }
  }, [pathname])

  return <>{children}</>
}
