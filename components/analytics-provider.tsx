'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { analytics } from '@/lib/analytics'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    // Track page views
    if (pathname) {
      analytics.pageView(pathname)
    }
  }, [pathname])

  return <>{children}</>
}
