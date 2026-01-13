'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function SermonSkeleton() {
  return (
    <article className="border border-border/30 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-4 w-24" />
    </article>
  )
}
