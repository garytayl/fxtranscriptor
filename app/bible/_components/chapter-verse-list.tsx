"use client"

import { VerseWords } from "./verse-words"
import { isVerseInRange } from "@/lib/bible/reference"
import type { VerseRange } from "@/lib/bible/reference"

export type FootnoteEntry = string | { text: string; href?: string }

type ChapterVerseListProps = {
  verses: { number: number; text: string }[]
  highlightRange: VerseRange | null
  /** Footnote by verse and marker; may include kind/target for cross-ref links. */
  footnotes?: {
    verseNumber: number
    marker: string
    text: string
    kind?: string | null
    targetBookSlug?: string | null
    targetChapter?: number | null
    targetVerse?: number | null
  }[]
}

function buildFootnotesByVerse(
  footnotes: NonNullable<ChapterVerseListProps["footnotes"]>
): Record<number, Record<string, FootnoteEntry>> {
  const byVerse: Record<number, Record<string, FootnoteEntry>> = {}
  for (const f of footnotes) {
    if (!byVerse[f.verseNumber]) byVerse[f.verseNumber] = {}
    const isCrossRef =
      f.kind === "cross_reference" &&
      f.targetBookSlug != null &&
      f.targetChapter != null &&
      f.targetVerse != null
    byVerse[f.verseNumber][f.marker] = isCrossRef
      ? { text: f.text, href: `/bible/${f.targetBookSlug}/${f.targetChapter}?v=${f.targetVerse}` }
      : f.text
  }
  return byVerse
}

export function ChapterVerseList({ verses, highlightRange, footnotes }: ChapterVerseListProps) {
  const footnotesByVerse = footnotes ? buildFootnotesByVerse(footnotes) : {}
  return (
    <ol className="space-y-1 sm:space-y-2 text-[0.9375rem] sm:text-base leading-[1.8] sm:leading-relaxed">
      {verses.map((verse) => {
        const isHighlighted = highlightRange ? isVerseInRange(verse.number, highlightRange) : false
        const footnotesForVerse = footnotesByVerse[verse.number]
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
              footnotesForVerse={footnotesForVerse}
            />
          </li>
        )
      })}
    </ol>
  )
}
