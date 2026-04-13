"use client"

import { WordStudySidebarPanel } from "@/app/bible/_components/word-study-sidebar"
import { MorphologySidebarPanel } from "@/app/bible/_components/morphology-sidebar"
import { getGreekMorphToken } from "@/lib/bible/morph-lookup"

export type ChapterStudySelection =
  | { kind: "strongs"; code: string }
  | { kind: "greekMorph"; verse: number; wordIndex: number }
  | null

type ChapterStudySidebarProps = {
  bookSlug: string
  /** API/HCSB book id (e.g. LUK) so morph lookup matches bundled data when URL slug differs. */
  bookId?: string
  chapterNumber: number
  selection: ChapterStudySelection
  hasStrongsForChapter: boolean
  hasGreekMorph: boolean
}

export function ChapterStudySidebar({
  bookSlug,
  bookId,
  chapterNumber,
  selection,
  hasStrongsForChapter,
  hasGreekMorph,
}: ChapterStudySidebarProps) {
  if (selection?.kind === "strongs") {
    return <WordStudySidebarPanel code={selection.code} hasStrongsForChapter={hasStrongsForChapter} />
  }

  if (selection?.kind === "greekMorph") {
    const token = getGreekMorphToken(
      bookSlug,
      chapterNumber,
      selection.verse,
      selection.wordIndex,
      bookId,
    )
    return (
      <MorphologySidebarPanel
        token={token}
        verseNumber={selection.verse}
        wordIndex={selection.wordIndex}
      />
    )
  }

  return (
    <div className="space-y-5 text-sm text-white/40">
      {hasStrongsForChapter && (
        <WordStudySidebarPanel code={null} hasStrongsForChapter={hasStrongsForChapter} />
      )}
      {hasGreekMorph && (
        <div className={hasStrongsForChapter ? "border-t border-white/10 pt-4" : ""}>
          <MorphologySidebarPanel token={null} verseNumber={0} wordIndex={0} />
        </div>
      )}
      {!hasStrongsForChapter && !hasGreekMorph && (
        <p className="italic text-white/35">No word study data for this chapter.</p>
      )}
    </div>
  )
}
