import { notFound } from "next/navigation"

import { BibleChapterShell } from "@/app/bible/_components/bible-chapter-shell"
import { getBookBySlug, getChapterVerses, listChapters } from "@/lib/bible/api"
import { parseVerseRange } from "@/lib/bible/reference"
import {
  getResolvedTranslations,
  getResolvedTranslationByKey,
  isKjvTranslationKey,
} from "@/lib/bible/translations"
import { getStrongsWordsForChapter } from "@/lib/bible/verse-strongs"
import { getKeyTermsForChapter } from "@/lib/bible/chapter-key-terms"

export const revalidate = 3600

type PageProps = {
  params: Promise<{
    bookSlug: string
    chapterNumber: string
  }>
  searchParams: Promise<{
    v?: string | string[]
    t?: string | string[]
  }>
}

export default async function BibleChapterPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const chapterNumber = Number(resolvedParams.chapterNumber)
  if (!Number.isFinite(chapterNumber)) {
    notFound()
  }

  const verseQuery = Array.isArray(resolvedSearchParams.v) ? resolvedSearchParams.v[0] : resolvedSearchParams.v
  const translationParam = Array.isArray(resolvedSearchParams.t) ? resolvedSearchParams.t[0] : resolvedSearchParams.t
  const translations = await getResolvedTranslations()
  const translation = await getResolvedTranslationByKey(translationParam)
  const activeKey = translation?.key ?? translationParam ?? null

  const book = await getBookBySlug(resolvedParams.bookSlug, translation?.bibleId)
  if (!book) {
    notFound()
  }

  let chapters = await listChapters(book.id, translation?.bibleId)
  chapters = chapters.sort((a, b) => a.number - b.number)

  const currentChapter = chapters.find((chapter) => chapter.number === chapterNumber)
  if (!currentChapter) {
    notFound()
  }

  const highlightRange = parseVerseRange(verseQuery)
  let errorMessage: string | null = null
  let verses: { number: number; text: string }[] = []

  let footnotes: { verseNumber: number; marker: string; text: string }[] | undefined
  try {
    const chapterResponse = await getChapterVerses(
      { chapterId: currentChapter.id, bookId: book.id },
      translation?.bibleId
    )
    verses = chapterResponse.verses
    footnotes = "footnotes" in chapterResponse ? chapterResponse.footnotes : undefined
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load chapter."
  }

  const currentIndex = chapters.findIndex((chapter) => chapter.id === currentChapter.id)
  const previousChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null
  const query = activeKey ? `?t=${activeKey}` : ""
  const keyTerms = getKeyTermsForChapter(book.slug, chapterNumber)
  const kjvWordStudyEnabled = isKjvTranslationKey(activeKey)
  const strongsWordsByVerse =
    kjvWordStudyEnabled && verses.length > 0
      ? await getStrongsWordsForChapter({ slug: book.slug, id: book.id }, chapterNumber)
      : {}

  return (
    <BibleChapterShell
      book={{ slug: book.slug, name: book.name }}
      chapterNumber={chapterNumber}
      chapters={chapters}
      verses={verses}
      highlightRange={highlightRange}
      kjvWordStudyEnabled={kjvWordStudyEnabled}
      strongsWordsByVerse={strongsWordsByVerse}
      keyTerms={keyTerms}
      previousChapter={previousChapter ?? null}
      nextChapter={nextChapter ?? null}
      query={query}
      errorMessage={errorMessage}
      translations={translations}
      activeKey={activeKey}
      footnotes={footnotes}
    />
  )
}
