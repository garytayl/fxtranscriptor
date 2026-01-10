"use client"

import { useRef, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { SermonSeries } from "@/lib/extractSeries"
import { format } from "date-fns"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface SeriesCardProps {
  series: SermonSeries
  index: number
  onClick: () => void
  persistHover?: boolean
}

export function SeriesCard({ series, index, onClick, persistHover = false }: SeriesCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const [isScrollActive, setIsScrollActive] = useState(false)

  useEffect(() => {
    if (!persistHover || !cardRef.current) return

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: cardRef.current,
        start: "top 80%",
        onEnter: () => setIsScrollActive(true),
        markers: false, // Disable debug markers
        refreshPriority: -1, // Lower priority
      })
    }, cardRef)

    return () => ctx.revert()
  }, [persistHover])

  const isActive = isHovered || isScrollActive

  // Format date range
  const dateRange = series.latestDate && series.oldestDate
    ? series.latestDate !== series.oldestDate
      ? `${format(new Date(series.oldestDate), "MMM yyyy")} - ${format(new Date(series.latestDate), "MMM yyyy")}`
      : format(new Date(series.latestDate), "MMMM yyyy")
    : series.latestDate
    ? format(new Date(series.latestDate), "MMMM yyyy")
    : null

  return (
    <article
      ref={cardRef}
      className={cn(
        "group relative border border-border/40 p-8 flex flex-col justify-between transition-all duration-500 cursor-pointer overflow-hidden min-w-[320px] max-w-[400px]",
        isActive && "border-accent/60",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Background layer */}
      <div
        className={cn(
          "absolute inset-0 bg-accent/5 transition-opacity duration-500",
          isActive ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Top torn edge effect */}
      <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

      {/* Content */}
      <div className="relative z-10">
        {/* Issue number - editorial style */}
        <div className="flex items-baseline justify-between mb-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Series {String(index + 1).padStart(2, "0")}
          </span>
          {dateRange && (
            <time className="font-mono text-[10px] text-muted-foreground/60">{dateRange}</time>
          )}
        </div>

        {/* Series title */}
        <h3
          className={cn(
            "font-[var(--font-bebas)] text-3xl md:text-4xl tracking-tight mb-4 transition-colors duration-300",
            isActive ? "text-accent" : "text-foreground",
          )}
        >
          {series.name}
        </h3>

        {/* Divider line */}
        <div className={cn(
          "w-12 h-px bg-accent/60 mb-6 transition-all duration-500",
          isActive ? "w-full" : ""
        )} />

        {/* Stats */}
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Sermons</span>
            <span className={isActive ? "text-accent" : ""}>{series.sermonCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Transcripts</span>
            <span className={isActive ? "text-accent" : ""}>{series.transcriptCount}</span>
          </div>
        </div>
      </div>

      {/* Description - reveals on hover */}
      <div className="relative z-10 mt-6">
        <p
          className={cn(
            "font-mono text-xs text-muted-foreground leading-relaxed transition-all duration-500",
            isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          )}
        >
          Click to view all sermons in this series
        </p>
      </div>

      {/* Bottom right corner fold effect */}
      <div className="absolute bottom-0 right-0 w-6 h-6 overflow-hidden">
        <div className="absolute bottom-0 right-0 w-8 h-8 bg-background rotate-45 translate-x-4 translate-y-4 border-t border-l border-border/30" />
      </div>

      {/* Shadow/depth layer */}
      <div
        className={cn(
          "absolute inset-0 -z-10 translate-x-1 translate-y-1 bg-accent/5 transition-opacity duration-300",
          isActive ? "opacity-100" : "opacity-0",
        )}
      />
    </article>
  )
}
