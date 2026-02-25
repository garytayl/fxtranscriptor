"use client"

import { useEffect } from "react"

export function ScrollToVerse({ verseNumber }: { verseNumber: number }) {
  useEffect(() => {
    const el = document.getElementById(`v${verseNumber}`)
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      })
    }
  }, [verseNumber])

  return null
}
