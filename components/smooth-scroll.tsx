"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import Lenis from "lenis"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const lenis = new Lenis({
      // Use lerp instead of duration for smooth follow (reduces jumpy catch-up feel)
      lerp: 0.08,
      orientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      syncTouch: true,
      syncTouchLerp: 0.08,
    })

    lenisRef.current = lenis

    // Connect Lenis to GSAP ScrollTrigger — run Lenis first then update so ScrollTrigger uses same scroll position
    function raf(time: number) {
      lenis.raf(time)
      ScrollTrigger.update()
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    // Enable ScrollTrigger refresh on window resize
    const handleResize = () => {
      ScrollTrigger.refresh()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      lenis.destroy()
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return <>{children}</>
}
