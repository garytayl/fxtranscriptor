"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import Lenis from "lenis"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/** Prefer native scroll on touch-primary devices (phones/tablets) so mobile scrolling works. */
function isTouchPrimaryDevice() {
  return window.matchMedia("(pointer: coarse)").matches
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    // Skip Lenis on touch devices — Lenis handling touch can break native scroll on mobile
    if (isTouchPrimaryDevice()) {
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

    const handleResize = () => {
      ScrollTrigger.refresh()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("wheel", allowZoom, { capture: true })
      lenis.destroy()
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return <>{children}</>
}
