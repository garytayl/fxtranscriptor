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
      duration: 0.8, // Reduced from 1.2 for snappier scrolling
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1, // Reduce scroll sensitivity for smoother feel
    })

    lenisRef.current = lenis

    // Connect Lenis to GSAP ScrollTrigger with requestAnimationFrame
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
