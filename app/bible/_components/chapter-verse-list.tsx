"use client"

import { VerseWords } from "./verse-words"
import { GreekMorphWords } from "@/app/bible/_components/greek-morph-words"
import { isVerseInRange } from "@/lib/bible/reference"
import type { VerseRange } from "@/lib/bible/reference"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import type { StrongsWordAndCode } from "@/lib/bible/verse-strongs"
import type { ChapterStudySelection } from "@/app/bible/_components/chapter-study-sidebar"

export type FootnoteEntry = string | { text: string; href?: string }

type ChapterVerseListProps = {
  verses: { number: number; text: string }[]
  highlightRange: VerseRange | null
  /** KJV word + code per verse; when present for a verse, that verse is rendered from this (correct alignment). */
  strongsWordsByVerse?: Record<number, StrongsWordAndCode[]>
  /** Called when a word with Strong's is clicked (e.g. to show in sidebar). */
  onSelectStrongs?: (code: string) => void
  /** Greek morph tokens per verse (MorphGNT chapters). */
  greekMorphByVerse?: Record<number, GreekMorphToken[]>
  /** Current sidebar selection (highlights Greek word). */
  studySelection?: ChapterStudySelection
  onSelectGreekMorph?: (verseNumber: number, wordIndex: number) => void
  /** Show terse morph codes under Greek words */
  greekWordHints?: boolean
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

export function ChapterVerseList({
  verses,
  highlightRange,
  strongsWordsByVerse = {},
  onSelectStrongs,
  greekMorphByVerse = {},
  studySelection,
  onSelectGreekMorph,
  greekWordHints = false,
  footnotes,
}: ChapterVerseListProps) {
  const footnotesByVerse = footnotes ? buildFootnotesByVerse(footnotes) : {}
  return (
    <ol className="space-y-1 sm:space-y-2 text-[0.9375rem] sm:text-base leading-[1.8] sm:leading-relaxed">
      {verses.map((verse) => {
        const isHighlighted = highlightRange ? isVerseInRange(verse.number, highlightRange) : false
        const wordsWithCodes = strongsWordsByVerse[verse.number]
        const footnotesForVerse = footnotesByVerse[verse.number]
        const greekTokens = greekMorphByVerse[verse.number]
        const greekSel =
          studySelection?.kind === "greekMorph" && studySelection.verse === verse.number
            ? studySelection.wordIndex
            : null
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
              wordsWithCodes={wordsWithCodes}
              highlightStrongs={true}
              onSelectStrongs={onSelectStrongs}
              footnotesForVerse={footnotesForVerse}
            />
            {greekTokens && greekTokens.length > 0 && onSelectGreekMorph ? (
              <GreekMorphWords
                verseNumber={verse.number}
                tokens={greekTokens}
                selectedIndex={greekSel}
                onSelect={onSelectGreekMorph}
                wordHintsEnabled={greekWordHints}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
