"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { SermonSeries } from "@/lib/extractSeries"
import { SeriesCard } from "./series-card"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface SermonSeriesSectionProps {
  series: SermonSeries[]
  onSeriesClick: (series: SermonSeries) => void
}

export function SermonSeriesSection({ series, onSeriesClick }: SermonSeriesSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !headerRef.current || !cardsRef.current) return

    const ctx = gsap.context(() => {
      // Header slide in from left
      gsap.fromTo(
        headerRef.current,
        { x: -60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 90%",
            toggleActions: "play none none reverse",
          },
        },
      )

      // Cards slide in from left with stagger
      const cards = cardsRef.current?.querySelectorAll("article")
      if (cards && cards.length > 0) {
        gsap.fromTo(
          cards,
          { x: -100, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: {
              trigger: cardsRef.current,
              start: "top 90%",
              toggleActions: "play none none reverse",
            },
          },
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [series])

  if (series.length === 0) {
    return null
  }

  return (
    <section ref={sectionRef} id="sermons" className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
      {/* Section header */}
      <div ref={headerRef} className="mb-16 pr-6 md:pr-12">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">01 / Series</span>
        <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">SERMON SERIES</h2>
        <p className="mt-4 max-w-md font-mono text-xs text-muted-foreground leading-relaxed">
          {series.length} {series.length === 1 ? "series" : "series"} • Organized by series
        </p>
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={(el) => {
          scrollRef.current = el
          cardsRef.current = el
        }}
        className="flex gap-8 overflow-x-auto pb-8 pr-12 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {series.map((s, index) => (
          <SeriesCard
            key={s.id}
            series={s}
            index={index}
            onClick={() => onSeriesClick(s)}
            persistHover={index === 0}
          />
        ))}
      </div>
    </section>
  )
}
