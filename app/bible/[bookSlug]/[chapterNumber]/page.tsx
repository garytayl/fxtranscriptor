import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { ChapterJump } from "@/app/bible/_components/chapter-jump"
import { ScrollToVerse } from "@/app/bible/_components/scroll-to-verse"
import { getBookBySlug, getChapterVerses, listChapters } from "@/lib/bible/api"
import { isVerseInRange, parseVerseRange } from "@/lib/bible/reference"
import { TranslationSettings } from "@/app/bible/_components/translation-settings"
import { getResolvedTranslations, getResolvedTranslationByKey } from "@/lib/bible/translations"

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
  let chapterReference = ""

  try {
    const chapterResponse = await getChapterVerses(
      { chapterId: currentChapter.id, bookId: book.id },
      translation?.bibleId
    )
    verses = chapterResponse.verses
    chapterReference = chapterResponse.chapter.reference
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load chapter."
  }

  const currentIndex = chapters.findIndex((chapter) => chapter.id === currentChapter.id)
  const previousChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null
  const query = activeKey ? `?t=${activeKey}` : ""

  return (
    <main className="min-h-screen bg-background text-foreground">
      {highlightRange && <ScrollToVerse verseNumber={highlightRange.start} />}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-6 px-4 pb-16 pt-[var(--navbar-offset)]">
        <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 pt-3 sm:pt-4 backdrop-blur-md">
          {/* Row 1: Back link + chapter title */}
          <div className="flex items-center justify-between gap-3 pb-1 sm:pb-2">
            <div className="min-w-0">
              <Link
                href={`/bible/${book.slug}${query}`}
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-accent"
              >
                <ArrowLeft className="size-3 shrink-0" />
                {book.name}
              </Link>
            </div>
            <Suspense
              fallback={
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">...</div>
              }
            >
              <TranslationSettings translations={translations} currentKey={activeKey} />
            </Suspense>
          </div>
          {/* Row 2: Title + chapter jump */}
          <div className="flex items-end justify-between gap-3 pb-3 sm:pb-4">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
              {book.name} {chapterNumber}
            </h1>
            <ChapterJump
              bookSlug={book.slug}
              chapters={chapters}
              currentChapter={chapterNumber}
              translationKey={activeKey}
            />
          </div>
        </div>

        {highlightRange && (
          <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-accent flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            Verses {highlightRange.start}
            {highlightRange.end !== highlightRange.start && `–${highlightRange.end}`}
          </div>
        )}

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : verses.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            This chapter is unavailable right now.
          </div>
        ) : (
          <ol className="space-y-1 sm:space-y-2 text-[0.9375rem] sm:text-base leading-[1.8] sm:leading-relaxed">
            {verses.map((verse) => {
              const isHighlighted = isVerseInRange(verse.number, highlightRange)
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
                  <span>{verse.text}</span>
                </li>
              )
            })}
          </ol>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5 sm:pt-6">
          {previousChapter ? (
            <Link
              href={`/bible/${book.slug}/${previousChapter.number}${query}`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm text-foreground transition hover:border-accent/60 hover:bg-card active:border-accent/70 min-h-[44px] sm:min-h-0"
            >
              <ArrowLeft className="size-3" />
              <span className="hidden sm:inline">{book.name}</span> {previousChapter.number}
            </Link>
          ) : (
            <div />
          )}
          {nextChapter ? (
            <Link
              href={`/bible/${book.slug}/${nextChapter.number}${query}`}
              className="rounded-md border border-border bg-card/70 px-3 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm text-foreground transition hover:border-accent/60 hover:bg-card active:border-accent/70 min-h-[44px] sm:min-h-0"
            >
              <span className="hidden sm:inline">{book.name}</span> {nextChapter.number} →
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}
