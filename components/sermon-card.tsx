'use client'

import { memo } from 'react'
import { Calendar, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Sermon } from '@/lib/supabase'
import { format } from 'date-fns'

interface SermonCardProps {
  sermon: Sermon
  onClick: () => void
  getStatusBadge: (sermon: Sermon) => React.ReactElement
}

export const SermonCard = memo(function SermonCard({ sermon, onClick, getStatusBadge }: SermonCardProps) {
  return (
    <article
      className="group border border-border/30 p-6 hover:border-accent/50 transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="font-[var(--font-bebas)] text-xl tracking-tight line-clamp-2 flex-1 group-hover:text-accent transition-colors">
          {sermon.title}
        </h3>
        {getStatusBadge(sermon)}
      </div>
      
      {sermon.date && (
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mb-4">
          <Calendar className="size-3" />
          {format(new Date(sermon.date), "MMMM d, yyyy")}
        </div>
      )}
      
      {sermon.transcript && (
        <div className="mt-4">
          <span className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <CheckCircle2 className="size-3" />
            Transcript available
          </span>
        </div>
      )}
    </article>
  )
})
