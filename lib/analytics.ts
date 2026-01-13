/**
 * Analytics and error tracking utilities
 */

// Simple analytics implementation
// Can be extended to use services like Google Analytics, Plausible, etc.

interface AnalyticsEvent {
  name: string
  properties?: Record<string, any>
}

class Analytics {
  private enabled: boolean

  constructor() {
    // Enable analytics in production or when explicitly enabled
    this.enabled = 
      typeof window !== 'undefined' && 
      (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true')
  }

  track(event: AnalyticsEvent) {
    if (!this.enabled) {
      console.log('[Analytics]', event.name, event.properties)
      return
    }

    // Send to analytics service
    // Example: Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('event', event.name, event.properties)
    }

    // Example: Plausible
    if (typeof window !== 'undefined' && (window as any).plausible) {
      ;(window as any).plausible(event.name, { props: event.properties })
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event.name, event.properties)
    }
  }

  pageView(path: string) {
    this.track({
      name: 'page_view',
      properties: { path },
    })
  }

  sermonViewed(sermonId: string, sermonTitle: string) {
    this.track({
      name: 'sermon_viewed',
      properties: { sermonId, sermonTitle },
    })
  }

  transcriptGenerated(sermonId: string) {
    this.track({
      name: 'transcript_generated',
      properties: { sermonId },
    })
  }

  transcriptDownloaded(sermonId: string) {
    this.track({
      name: 'transcript_downloaded',
      properties: { sermonId },
    })
  }

  catalogSynced() {
    this.track({
      name: 'catalog_synced',
    })
  }

  searchPerformed(query: string, resultsCount: number) {
    this.track({
      name: 'search_performed',
      properties: { query, resultsCount },
    })
  }

  filterApplied(filter: string) {
    this.track({
      name: 'filter_applied',
      properties: { filter },
    })
  }

  batchOperation(operation: string, count: number) {
    this.track({
      name: 'batch_operation',
      properties: { operation, count },
    })
  }
}

class ErrorTracker {
  private enabled: boolean

  constructor() {
    this.enabled = 
      typeof window !== 'undefined' && 
      (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ERROR_TRACKING_ENABLED === 'true')
  }

  captureError(error: Error, context?: Record<string, any>) {
    if (!this.enabled) {
      console.error('[ErrorTracker]', error, context)
      return
    }

    // Send to error tracking service
    // Example: Sentry
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      ;(window as any).Sentry.captureException(error, { extra: context })
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorTracker]', error, context)
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
    if (!this.enabled) {
      console.log(`[ErrorTracker:${level}]`, message, context)
      return
    }

    // Send to error tracking service
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      ;(window as any).Sentry.captureMessage(message, { level, extra: context })
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ErrorTracker:${level}]`, message, context)
    }
  }
}

export const analytics = new Analytics()
export const errorTracker = new ErrorTracker()

// Helper to wrap async functions with error tracking
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      errorTracker.captureError(
        error instanceof Error ? error : new Error(String(error)),
        { context, args: args.map(a => String(a)) }
      )
      throw error
    }
  }) as T
}
