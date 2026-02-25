"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"

import { ChapterJump } from "@/app/bible/_components/chapter-jump"
import { ScrollToVerse } from "@/app/bible/_components/scroll-to-verse"
import { TranslationSettings } from "@/app/bible/_components/translation-settings"
import { ChapterWordStudy } from "@/app/bible/_components/chapter-word-study"
import { ChapterVerseList } from "@/app/bible/_components/chapter-verse-list"
import { WordStudySidebarPanel } from "@/app/bible/_components/word-study-sidebar"
import type { VerseRange } from "@/lib/bible/reference"
import type { BibleTranslation } from "@/lib/bible/translations"

type BookInfo = { slug: string; name: string }
type ChapterOption = { id: string; number: number }

export type BibleChapterShellProps = {
  book: BookInfo
  chapterNumber: number
  chapters: ChapterOption[]
  verses: { number: number; text: string }[]
  highlightRange: VerseRange | null
  strongsByVerse: Record<number, string[]>
  keyTerms: string[]
  previousChapter: ChapterOption | null
  nextChapter: ChapterOption | null
  query: string
  errorMessage: string | null
  translations: BibleTranslation[]
  activeKey: string | null
}

export function BibleChapterShell({
  book,
  chapterNumber,
  chapters,
  verses,
  highlightRange,
  strongsByVerse,
  keyTerms,
  previousChapter,
  nextChapter,
  query,
  errorMessage,
  translations,
  activeKey,
}: BibleChapterShellProps) {
  const [selectedStrongsCode, setSelectedStrongsCode] = useState<string | null>(null)
  const onSelectStrongs = useCallback((code: string) => setSelectedStrongsCode(code), [])

  return (
    <main className="min-h-screen bg-background text-foreground">
      {highlightRange && <ScrollToVerse verseNumber={highlightRange.start} />}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-6 px-4 pb-16 pt-[var(--navbar-offset)] lg:max-w-none lg:pr-[22rem]">
        <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 pt-3 sm:pt-4 backdrop-blur-md">
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
          <ChapterVerseList
            verses={verses}
            highlightRange={highlightRange}
            strongsByVerse={strongsByVerse}
            onSelectStrongs={onSelectStrongs}
          />
        )}

        {(verses.length > 0 || keyTerms.length > 0) && (
          <ChapterWordStudy bookSlug={book.slug} chapterNumber={chapterNumber} keyTerms={keyTerms} />
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

      {/* Sidebar — desktop: Greek & Hebrew word study */}
      <aside
        className="hidden lg:flex lg:flex-col fixed right-0 top-0 w-[22rem] bottom-0 border-l border-white/10 bg-[#050505] z-30 pt-[var(--navbar-offset)]"
        aria-label="Greek & Hebrew"
        style={{ height: "100dvh" }}
      >
        <div className="shrink-0 px-6 pt-6 pb-2">
          <p className="font-mono text-xs tracking-[0.25em] text-white/50 uppercase">
            Greek & Hebrew
          </p>
        </div>
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6"
          style={{ WebkitOverflowScrolling: "touch" }}
          data-lenis-prevent
        >
          <WordStudySidebarPanel code={selectedStrongsCode} />
        </div>
      </aside>
    </main>
  )
}
