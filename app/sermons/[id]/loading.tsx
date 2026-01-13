import { SermonSkeleton } from '@/components/sermon-skeleton'

export default function Loading() {
  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 py-12 pl-6 md:pl-28 pr-6 md:pr-12">
        <div className="mb-8">
          <div className="h-10 w-32 bg-muted animate-pulse rounded mb-4" />
          <div className="h-16 w-3/4 bg-muted animate-pulse rounded mb-6" />
          <div className="flex gap-4">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-12 w-full bg-muted animate-pulse rounded" />
          <div className="h-12 w-full bg-muted animate-pulse rounded" />
          <div className="h-64 w-full bg-muted animate-pulse rounded" />
        </div>
      </div>
    </main>
  )
}
