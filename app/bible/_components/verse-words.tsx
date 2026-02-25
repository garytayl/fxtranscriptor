"use client"

import { WordStudy } from "@/components/word-study"

type VerseWordsProps = {
  verseNumber: number
  text: string
  /** Strong's codes in word order (from KJV alignment). Word at index i gets strongs[i] if present. */
  strongs?: string[]
  className?: string
  /** When true, words with Strong's get hover styling. */
  highlightStrongs?: boolean
  /** Called when a word with Strong's is clicked (e.g. to show in sidebar). */
  onSelectStrongs?: (code: string) => void
}

/**
 * Splits verse text into words and renders each word; words with a Strong's code get a WordStudy hover.
 */
export function VerseWords({
  verseNumber,
  text,
  strongs = [],
  className = "",
  highlightStrongs = true,
  onSelectStrongs,
}: VerseWordsProps) {
  const words = text.split(/(\s+)/)
  const tokens: { type: "word" | "space"; value: string; index: number }[] = []
  let wordIndex = 0
  for (const w of words) {
    if (/^\s+$/.test(w)) {
      tokens.push({ type: "space", value: w, index: -1 })
    } else if (w) {
      tokens.push({ type: "word", value: w, index: wordIndex++ })
    }
  }

  return (
    <span className={className}>
      {tokens.map((t, i) => {
        if (t.type === "space") return <span key={i}>{t.value}</span>
        const code = strongs[t.index]
        if (code) {
          return (
            <WordStudy
              key={i}
              code={code}
              onSelect={onSelectStrongs}
              className={
                highlightStrongs
                  ? "text-foreground border-b border-dashed border-amber-500/40 hover:border-amber-500/70"
                  : undefined
              }
            >
              {t.value}
            </WordStudy>
          )
        }
        return <span key={i}>{t.value}</span>
      })}
    </span>
  )
}
