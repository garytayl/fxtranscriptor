"use client"

import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { getMorphHintAbbrev } from "@/lib/bible/greek-morph-hints"

export function GreekMorphWords({
  verseNumber,
  tokens,
  selectedIndex,
  onSelect,
  wordHintsEnabled = false,
}: {
  verseNumber: number
  tokens: GreekMorphToken[]
  selectedIndex: number | null
  onSelect: (verseNumber: number, wordIndex: number) => void
  /** Show tiny tense/mood/case codes under each word */
  wordHintsEnabled?: boolean
}) {
  if (!tokens.length) return null

  return (
    <span className="block mt-2 pl-6 sm:pl-8 border-l-2 border-amber-500/25 text-[0.8125rem] sm:text-sm leading-[1.85]">
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground block mb-1">
        Greek (SBL) · tap a word for tense, mood, participles &amp; cases
      </span>
      <span lang="el" className="text-foreground/95 inline-flex flex-wrap gap-x-1 gap-y-1 items-end">
        {tokens.map((tok, wi) => {
          const isSel = selectedIndex === wi
          const hint = wordHintsEnabled ? getMorphHintAbbrev(tok) : null
          return (
            <span key={`${verseNumber}-${wi}-${tok.word}`} className="inline-flex flex-col items-center gap-0">
              <button
                type="button"
                onClick={() => onSelect(verseNumber, wi)}
                className={
                  isSel
                    ? "text-amber-200 border-b-2 border-amber-400/80 pb-px"
                    : "text-foreground/90 border-b border-dashed border-amber-500/35 hover:border-amber-500/70"
                }
              >
                {tok.word}
              </button>
              {hint ? (
                <span className="font-mono text-[8px] leading-none text-amber-600/80 dark:text-amber-400/70 max-w-[4.5rem] truncate text-center" title={hint}>
                  {hint}
                </span>
              ) : null}
            </span>
          )
        })}
      </span>
    </span>
  )
}
