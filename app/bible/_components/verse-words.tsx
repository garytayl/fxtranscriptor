"use client"

import { VerseText } from "@/lib/bible/verse-text"

type VerseWordsProps = {
  /** Kept for call-site consistency; verse text comes from the selected translation. */
  verseNumber: number
  text: string
  className?: string
  /** Map marker -> text or { text, href } for tooltips and optional cross-ref link. */
  footnotesForVerse?: Record<string, string | { text: string; href?: string }>
}

/** Renders verse text from the active translation (API), with optional footnote markers. */
export function VerseWords({ text, className = "", footnotesForVerse }: VerseWordsProps) {
  return (
    <VerseText text={text} className={className} footnotesByMarker={footnotesForVerse} />
  )
}
