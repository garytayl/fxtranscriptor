"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Lenis from "lenis"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/** Prefer native scroll on touch-primary devices (phones/tablets) so mobile scrolling works. */
function isTouchPrimaryDevice() {
  return window.matchMedia("(pointer: coarse)").matches
}

/** Routes that use a full-screen overlay with their own scroll — skip Lenis so native scroll works. */
const LENIS_SKIP_PATHNAMES = ["/bible", "/devotions"]

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    // Skip Lenis on touch devices — Lenis handling touch can break native scroll on mobile
    if (isTouchPrimaryDevice()) {
      return
    }
    // Skip Lenis on picker index pages (full-screen overlay with inner scroll) so "What book?" etc. can scroll
    if (pathname && LENIS_SKIP_PATHNAMES.includes(pathname)) {
      return
    }

    const lenis = new Lenis({
      lerp: 0.08,
      orientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      syncTouch: false,
    })

    lenisRef.current = lenis

    /** Let browser handle zoom (Ctrl/Cmd + wheel). Stop propagation so Lenis does not preventDefault. */
    const allowZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.stopPropagation()
      }
    }
    window.addEventListener("wheel", allowZoom, { capture: true })

    function raf(time: number) {
      lenis.raf(time)
      ScrollTrigger.update()
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    const refreshScroll = () => {
      lenis.resize()
      ScrollTrigger.refresh()
    }
    window.addEventListener("resize", refreshScroll)
    let viewportRefreshScheduled = false
    const scheduleViewportRefresh = () => {
      if (viewportRefreshScheduled) return
      viewportRefreshScheduled = true
      requestAnimationFrame(() => {
        refreshScroll()
        viewportRefreshScheduled = false
      })
    }
    const visualViewport = window.visualViewport ?? null
    if (visualViewport) {
      visualViewport.addEventListener("resize", scheduleViewportRefresh)
      visualViewport.addEventListener("scroll", scheduleViewportRefresh)
    }

    return () => {
      window.removeEventListener("wheel", allowZoom, { capture: true })
      lenis.destroy()
      window.removeEventListener("resize", refreshScroll)
      if (visualViewport) {
        visualViewport.removeEventListener("resize", scheduleViewportRefresh)
        visualViewport.removeEventListener("scroll", scheduleViewportRefresh)
      }
    }
  }, [])

  return <>{children}</>
}
