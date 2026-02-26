"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { SplitFlapText } from "@/components/split-flap-text"
import { AnimatedNoise } from "@/components/animated-noise"
import { BitmapChevron } from "@/components/bitmap-chevron"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return

    const ctx = gsap.context(() => {
      gsap.to(contentRef.current, {
        y: -100,
        opacity: 0,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true, // Changed from 1 to true for smoother scrubbing
          markers: false, // Disable debug markers
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section 
      ref={sectionRef} 
      id="hero" 
      className="relative min-h-screen flex items-center pt-[var(--navbar-offset)] pl-4 sm:pl-6 md:pl-12 pr-4 sm:pr-6 md:pr-12"
      style={{ willChange: "transform" }} // GPU acceleration hint
    >
      <AnimatedNoise opacity={0.03} />

      {/* Left vertical label — hidden on small mobile to avoid overlapping content */}
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 hidden sm:block">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground -rotate-90 origin-left block whitespace-nowrap">
          FX ARCHIVE
        </span>
      </div>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 w-full">
        <div className="relative">
          <SplitFlapText text="FX ARCHIVE" speed={80} />
        </div>

        <h2 className="font-display text-muted-foreground/60 text-[clamp(1rem,3vw,2rem)] mt-4 tracking-wide">
          Sermon Transcript Archive
        </h2>

        <p className="mt-12 max-w-md font-mono text-sm text-muted-foreground leading-relaxed">
          Sermon transcript archive for FX Church (Foot of the Cross). Automatically syncs from Podbean and YouTube with one-click transcript generation.
        </p>

        <div className="mt-10 sm:mt-16 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
          <a
            href="#sermons"
            className="group inline-flex items-center gap-3 border border-foreground/20 px-5 sm:px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-all duration-200"
          >
            <ScrambleTextOnHover text="View Sermons" as="span" duration={0.6} />
            <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
          </a>
          <div className="flex items-center gap-5 sm:gap-8">
            <a
              href="#recent"
              className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              Recent Transcripts
            </a>
            <Link
              href="/bible"
              className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              Scripture Reader
            </Link>
          </div>
        </div>
      </div>

      {/* Floating info tag */}
      <div className="absolute bottom-8 right-8 md:bottom-12 md:right-12">
        <div className="border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          v.01 / Experimental Build
        </div>
      </div>
    </section>
  )
}
