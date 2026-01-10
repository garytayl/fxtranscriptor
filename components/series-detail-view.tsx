"use client"

import { useRef, useEffect, type ReactElement } from "react"
import { SermonSeries } from "@/lib/extractSeries"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Play, Download, Copy, CheckCircle2, AlertCircle, Loader2, Calendar, ExternalLink, ArrowLeft } from "lucide-react"
import { format } from "date-fns"
import { Sermon as SermonType } from "@/lib/supabase"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface SeriesDetailViewProps {
  series: SermonSeries | null
  onClose: () => void
  onGenerateTranscript: (sermon: SermonType) => Promise<void>
  onViewTranscript: (sermon: SermonType) => void
  onDownload: (sermon: SermonType) => void
  onCopyTranscript: (transcript: string) => Promise<void>
  generating: Set<string>
  getStatusBadge: (sermon: SermonType) => ReactElement
  getSourceBadge: (source: string | null) => ReactElement | null
  copied: boolean
}

export function SeriesDetailView({
  series,
  onClose,
  onGenerateTranscript,
  onViewTranscript,
  onDownload,
  onCopyTranscript,
  generating,
  getStatusBadge,
  getSourceBadge,
  copied,
}: SeriesDetailViewProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const sermonsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!series || !sectionRef.current) return

    const ctx = gsap.context(() => {
      // Header fade in
      if (headerRef.current) {
        gsap.from(headerRef.current, {
          opacity: 0,
          y: 20,
          duration: 0.6,
          ease: "power2.out",
        })
      }

      // Sermons fade in with stagger
      if (sermonsRef.current) {
        const sermonCards = sermonsRef.current.querySelectorAll("article")
        gsap.from(sermonCards, {
          opacity: 0,
          y: 30,
          duration: 0.4, // Reduced for snappier animations
          stagger: 0.08, // Reduced stagger
          ease: "power2.out",
          scrollTrigger: {
            trigger: sermonsRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
            markers: false, // Disable debug markers
            refreshPriority: -1, // Lower priority
          },
        })
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [series])

  if (!series) return null

  return (
    <section ref={sectionRef} className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12 min-h-screen">
      {/* Header */}
      <div ref={headerRef} className="mb-16">
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="mb-8 font-mono text-xs uppercase tracking-widest gap-2 hover:text-accent"
        >
          <ArrowLeft className="size-4" />
          Back to Series
        </Button>

        <div className="mb-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Series Detail</span>
          <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">{series.name}</h2>
          <div className="mt-4 flex items-center gap-4 flex-wrap font-mono text-xs text-muted-foreground">
            <span>{series.sermonCount} {series.sermonCount === 1 ? "sermon" : "sermons"}</span>
            <span>•</span>
            <span>{series.transcriptCount} {series.transcriptCount === 1 ? "transcript" : "transcripts"}</span>
            {series.latestDate && (
              <>
                <span>•</span>
                <span>{format(new Date(series.latestDate), "MMMM yyyy")}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sermons Grid */}
      <div ref={sermonsRef} className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {series.sermons.map((sermon) => (
          <article
            key={sermon.id}
            className="group relative border border-border/40 p-6 flex flex-col justify-between transition-all duration-300 hover:border-accent/60 hover:bg-accent/5"
          >
            {/* Sermon Title */}
            <div className="mb-4">
              <h3 className="font-[var(--font-bebas)] text-xl md:text-2xl tracking-tight mb-2 group-hover:text-accent transition-colors duration-300 line-clamp-2">
                {sermon.title}
              </h3>
              {sermon.date && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mb-3">
                  <Calendar className="size-3" />
                  {format(new Date(sermon.date), "MMM d, yyyy")}
                </div>
              )}
              {sermon.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 font-mono text-xs leading-relaxed mb-4">
                  {sermon.description}
                </p>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {getStatusBadge(sermon)}
              {sermon.transcript_source && getSourceBadge(sermon.transcript_source)}
              {sermon.podbean_url && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <ExternalLink className="size-3" />
                  Podbean
                </Badge>
              )}
              {sermon.youtube_url && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <ExternalLink className="size-3" />
                  YouTube
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {sermon.transcript ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 font-mono text-xs uppercase tracking-widest border-foreground/20 hover:border-accent hover:text-accent"
                    onClick={() => onViewTranscript(sermon)}
                  >
                    <Play className="size-4" />
                    View Transcript
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 font-mono text-xs uppercase tracking-widest"
                    onClick={() => onDownload(sermon)}
                  >
                    <Download className="size-4" />
                    Download
                  </Button>
                </>
              ) : (
                <Button
                  variant={sermon.status === "generating" ? "secondary" : "default"}
                  size="sm"
                  className="w-full gap-2 font-mono text-xs uppercase tracking-widest"
                  disabled={generating.has(sermon.id) || sermon.status === "generating"}
                  onClick={() => onGenerateTranscript(sermon)}
                >
                  {generating.has(sermon.id) || sermon.status === "generating" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating...
                    </>
                  ) : sermon.status === "failed" ? (
                    <>
                      <AlertCircle className="size-4" />
                      Retry Generate
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Generate Transcript
                    </>
                  )}
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
