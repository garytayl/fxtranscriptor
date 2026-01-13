'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2, Play, Trash2, Download, X } from 'lucide-react'
import { Sermon } from '@/lib/supabase'
import { analytics } from '@/lib/analytics'

interface BatchOperationsProps {
  sermons: Sermon[]
  onGenerate: (sermonIds: string[]) => Promise<void>
  onDelete?: (sermonIds: string[]) => Promise<void>
  onExport?: (sermons: Sermon[]) => void
  className?: string
}

export function BatchOperations({
  sermons,
  onGenerate,
  onDelete,
  onExport,
  className = '',
}: BatchOperationsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(sermons.map((s) => s.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleBatchGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.warning('No sermons selected', {
        description: 'Please select at least one sermon to generate transcripts for.',
        duration: 3000,
      })
      return
    }

    const eligibleSermons = sermons.filter(
      (s) =>
        selectedIds.has(s.id) &&
        s.status !== 'generating' &&
        s.status !== 'completed' &&
        (s.audio_url || s.youtube_url)
    )

    if (eligibleSermons.length === 0) {
      toast.warning('No eligible sermons', {
        description: 'Selected sermons must have an audio URL or YouTube URL and not already be generating/completed.',
        duration: 4000,
      })
      return
    }

    setIsProcessing(true)
    const toastId = toast.loading(`Generating transcripts for ${eligibleSermons.length} sermons...`, {
      description: 'This may take a while. You can leave this page.',
    })

    try {
      await Promise.all(eligibleSermons.map((s) => onGenerate([s.id])))
      analytics.batchOperation('generate', eligibleSermons.length)
      toast.dismiss(toastId)
      toast.success('Batch Generation Started', {
        description: `Started transcription for ${eligibleSermons.length} sermons.`,
        duration: 5000,
      })
      clearSelection()
    } catch (error) {
      toast.dismiss(toastId)
      toast.error('Batch Generation Failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 6000,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.warning('No sermons selected')
      return
    }

    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} sermon${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`
      )
    ) {
      return
    }

    if (!onDelete) {
      toast.error('Delete operation not available')
      return
    }

    setIsProcessing(true)
    const toastId = toast.loading(`Deleting ${selectedIds.size} sermons...`)

    try {
      await onDelete(Array.from(selectedIds))
      analytics.batchOperation('delete', selectedIds.size)
      toast.dismiss(toastId)
      toast.success('Sermons Deleted', {
        description: `Successfully deleted ${selectedIds.size} sermon${selectedIds.size > 1 ? 's' : ''}.`,
        duration: 3000,
      })
      clearSelection()
    } catch (error) {
      toast.dismiss(toastId)
      toast.error('Delete Failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 6000,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBatchExport = () => {
    if (selectedIds.size === 0) {
      toast.warning('No sermons selected')
      return
    }

    const selectedSermons = sermons.filter((s) => selectedIds.has(s.id))
    if (onExport) {
      analytics.batchOperation('export', selectedSermons.length)
      onExport(selectedSermons)
      toast.success('Export Started', {
        description: `Exporting ${selectedSermons.length} sermon${selectedSermons.length > 1 ? 's' : ''}.`,
        duration: 2000,
      })
    }
  }

  if (sermons.length === 0) {
    return null
  }

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-border/30 rounded-lg bg-card/50 ${className}`}>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={selectedIds.size === sermons.length && sermons.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              selectAll()
            } else {
              clearSelection()
            }
          }}
        />
        <span className="text-sm font-mono text-muted-foreground">
          {selectedIds.size > 0
            ? `${selectedIds.size} of ${sermons.length} selected`
            : `Select all (${sermons.length})`}
        </span>
      </div>

      {selectedIds.size > 0 && (
        <>
          <div className="flex-1" />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs uppercase tracking-widest gap-2"
              onClick={handleBatchGenerate}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Play className="size-3" />
              )}
              Generate ({selectedIds.size})
            </Button>
            {onExport && (
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs uppercase tracking-widest gap-2"
                onClick={handleBatchExport}
                disabled={isProcessing}
              >
                <Download className="size-3" />
                Export ({selectedIds.size})
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs uppercase tracking-widest gap-2 border-destructive/50 hover:border-destructive hover:text-destructive"
                onClick={handleBatchDelete}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
                Delete ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs uppercase tracking-widest"
              onClick={clearSelection}
            >
              <X className="size-3" />
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
