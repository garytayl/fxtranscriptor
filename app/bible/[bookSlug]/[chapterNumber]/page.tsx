import Link from "next/link"
import { notFound } from "next/navigation"

import { ChapterJump } from "@/app/bible/_components/chapter-jump"
import { getBookBySlug, getChapterVerses, listChapters } from "@/lib/bible/api"
import { isVerseInRange, parseVerseRange } from "@/lib/bible/reference"

export const revalidate = 3600

type PageProps = {
  params: {
    bookSlug: string
    chapterNumber: string
  }
  searchParams: {
    v?: string | string[]
  }
}

export default async function BibleChapterPage({ params, searchParams }: PageProps) {
  const chapterNumber = Number(params.chapterNumber)
  if (!Number.isFinite(chapterNumber)) {
    notFound()
  }

  const book = await getBookBySlug(params.bookSlug)
  if (!book) {
    notFound()
  }

  let chapters = await listChapters(book.id)
  chapters = chapters.sort((a, b) => a.number - b.number)

  const currentChapter = chapters.find((chapter) => chapter.number === chapterNumber)
  if (!currentChapter) {
    notFound()
  }

  const verseQuery = Array.isArray(searchParams.v) ? searchParams.v[0] : searchParams.v
  const highlightRange = parseVerseRange(verseQuery)
  let errorMessage: string | null = null
  let verses: { number: number; text: string }[] = []
  let chapterReference = ""

  try {
    const chapterResponse = await getChapterVerses({ chapterId: currentChapter.id, bookId: book.id })
    verses = chapterResponse.verses
    chapterReference = chapterResponse.chapter.reference
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load chapter."
  }

  const currentIndex = chapters.findIndex((chapter) => chapter.id === currentChapter.id)
  const previousChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-16 pt-6">
        <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/90 px-4 pt-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-6 pb-4">
            <div className="space-y-1">
              <Link
                href={`/bible/${book.slug}`}
                className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent"
              >
                ← {book.name} chapters
              </Link>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {book.name} {chapterNumber}
              </h1>
              {chapterReference && <p className="text-sm text-muted-foreground">{chapterReference}</p>}
            </div>
            <ChapterJump
              bookSlug={book.slug}
              chapters={chapters}
              currentChapter={chapterNumber}
            />
          </div>
        </div>

        {highlightRange && (
          <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-accent">
            Highlighting verses {highlightRange.start}
            {highlightRange.end !== highlightRange.start && `-${highlightRange.end}`}
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
          <ol className="space-y-4 text-base leading-relaxed">
            {verses.map((verse) => {
              const isHighlighted = isVerseInRange(verse.number, highlightRange)
              return (
                <li
                  key={verse.number}
                  id={`v${verse.number}`}
                  className={`scroll-mt-28 rounded-md px-3 py-2 transition ${
                    isHighlighted ? "bg-accent/15 text-foreground" : "text-foreground"
                  }`}
                >
                  <a
                    href={`#v${verse.number}`}
                    className="mr-2 align-super text-xs font-semibold text-muted-foreground hover:text-accent"
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

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          {previousChapter ? (
            <Link
              href={`/bible/${book.slug}/${previousChapter.number}`}
              className="rounded-md border border-border bg-card/70 px-4 py-2 text-sm text-foreground transition hover:border-accent/60 hover:bg-card"
            >
              ← {book.name} {previousChapter.number}
            </Link>
          ) : (
            <div />
          )}
          {nextChapter ? (
            <Link
              href={`/bible/${book.slug}/${nextChapter.number}`}
              className="rounded-md border border-border bg-card/70 px-4 py-2 text-sm text-foreground transition hover:border-accent/60 hover:bg-card"
            >
              {book.name} {nextChapter.number} →
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}
