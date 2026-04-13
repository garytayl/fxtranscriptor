"use client"

import type { GreekMorphToken } from "@/lib/bible/morph-types"

export function GreekMorphWords({
  verseNumber,
  tokens,
  selectedIndex,
  onSelect,
}: {
  verseNumber: number
  tokens: GreekMorphToken[]
  selectedIndex: number | null
  onSelect: (verseNumber: number, wordIndex: number) => void
}) {
  if (!tokens.length) return null

  return (
    <span className="block mt-2 pl-6 sm:pl-8 border-l-2 border-amber-500/25 text-[0.8125rem] sm:text-sm leading-[1.85]">
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground block mb-1">
        Greek (SBL) · tap for grammar
      </span>
      <span lang="el" className="text-foreground/95">
        {tokens.map((tok, wi) => {
          const isSel = selectedIndex === wi
          return (
            <span key={`${verseNumber}-${wi}-${tok.word}`}>
              {wi > 0 ? "\u00a0" : null}
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
            </span>
          )
        })}
      </span>
    </span>
  )
}
