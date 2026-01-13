'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { SermonCard } from './sermon-card'
import { Sermon } from '@/lib/supabase'

interface VirtualSermonListProps {
  sermons: Sermon[]
  getStatusBadge: (sermon: Sermon) => React.ReactElement
  onSermonClick: (sermon: Sermon) => void
  className?: string
}

export function VirtualSermonList({ 
  sermons, 
  getStatusBadge, 
  onSermonClick,
  className = ''
}: VirtualSermonListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: sermons.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated height of each sermon card
    overscan: 5, // Render 5 extra items outside viewport
  })

  if (sermons.length === 0) {
    return null
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: '100%', contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const sermon = sermons[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <SermonCard
                sermon={sermon}
                onClick={() => onSermonClick(sermon)}
                getStatusBadge={getStatusBadge}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
