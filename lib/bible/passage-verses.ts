import "server-only"

import { getChapterVerses, listChapters } from "@/lib/bible/api"
import type { PassageReference } from "@/lib/bible/reference"
import { isVerseInRange } from "@/lib/bible/reference"
import type { BibleVerse } from "@/lib/bible/types"

/** Verse text with chapter number (needed when a passage spans multiple chapters). */
export type BibleVerseWithChapter = BibleVerse & { chapter: number }

/**
 * Load verse text for a parsed reference, including cross-chapter ranges (e.g. Gal 4:8-5:1).
 */
export async function getVersesForPassageReference(
  parsed: PassageReference,
  bookId: string,
  translationBibleId?: string
): Promise<{ verses: BibleVerseWithChapter[]; error?: string }> {
  const chapters = await listChapters(bookId, translationBibleId)

  if (!parsed.crossChapterEnd) {
    const chapter = chapters.find((c) => c.number === parsed.chapterNumber)
    if (!chapter) {
      return { verses: [], error: `Chapter ${parsed.chapterNumber} not found for book.` }
    }
    const chapterResponse = await getChapterVerses(
      { chapterId: chapter.id, bookId },
      translationBibleId
    )
    const versesRaw = parsed.verseRange
      ? chapterResponse.verses.filter((v) => isVerseInRange(v.number, parsed.verseRange))
      : chapterResponse.verses
    return {
      verses: versesRaw.map((v) => ({ ...v, chapter: parsed.chapterNumber })),
    }
  }

  const startCh = parsed.chapterNumber
  const endCh = parsed.crossChapterEnd.chapter
  const startVs = parsed.verseRange?.start ?? 1
  const endVs = parsed.crossChapterEnd.verse
  const out: BibleVerseWithChapter[] = []

  for (let ch = startCh; ch <= endCh; ch++) {
    const chapter = chapters.find((c) => c.number === ch)
    if (!chapter) {
      return { verses: [], error: `Chapter ${ch} not found for book.` }
    }
    const chapterResponse = await getChapterVerses({ chapterId: chapter.id, bookId }, translationBibleId)
    let slice = chapterResponse.verses
    if (ch === startCh && ch === endCh) {
      slice = slice.filter((v) => v.number >= startVs && v.number <= endVs)
    } else if (ch === startCh) {
      slice = slice.filter((v) => v.number >= startVs)
    } else if (ch === endCh) {
      slice = slice.filter((v) => v.number <= endVs)
    }
    out.push(...slice.map((v) => ({ ...v, chapter: ch })))
  }

  return { verses: out }
}
