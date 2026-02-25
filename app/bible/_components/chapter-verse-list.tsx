"use client"

import { VerseWords } from "./verse-words"
import { isVerseInRange } from "@/lib/bible/reference"
import type { VerseRange } from "@/lib/bible/reference"

type ChapterVerseListProps = {
  verses: { number: number; text: string }[]
  highlightRange: VerseRange | null
  strongsByVerse: Record<number, string[]>
  /** Called when a word with Strong's is clicked (e.g. to show in sidebar). */
  onSelectStrongs?: (code: string) => void
}

export function ChapterVerseList({
  verses,
  highlightRange,
  strongsByVerse,
  onSelectStrongs,
}: ChapterVerseListProps) {
  return (
    <ol className="space-y-1 sm:space-y-2 text-[0.9375rem] sm:text-base leading-[1.8] sm:leading-relaxed">
      {verses.map((verse) => {
        const isHighlighted = highlightRange ? isVerseInRange(verse.number, highlightRange) : false
        const strongs = strongsByVerse[verse.number]
        return (
          <li
            key={verse.number}
            id={`v${verse.number}`}
            className={`scroll-mt-32 sm:scroll-mt-28 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors ${
              isHighlighted
                ? "bg-accent/20 border-l-2 border-accent/60 text-foreground"
                : "text-foreground"
            }`}
          >
            <a
              href={`#v${verse.number}`}
              className={`mr-1.5 sm:mr-2 align-super text-[10px] sm:text-xs font-bold hover:text-accent ${
                isHighlighted ? "text-accent" : "text-muted-foreground"
              }`}
              aria-label={`Link to verse ${verse.number}`}
            >
              {verse.number}
            </a>
            <VerseWords
              verseNumber={verse.number}
              text={verse.text}
              strongs={strongs}
              highlightStrongs={true}
              onSelectStrongs={onSelectStrongs}
            />
          </li>
        )
      })}
    </ol>
  )
}
