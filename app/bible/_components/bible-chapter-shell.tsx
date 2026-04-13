"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft, X, ChevronDown } from "lucide-react"
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls, type PanInfo } from "framer-motion"

import { ChapterJump } from "@/app/bible/_components/chapter-jump"
import { ScrollToVerse } from "@/app/bible/_components/scroll-to-verse"
import { TranslationSettings } from "@/app/bible/_components/translation-settings"
import { ChapterWordStudy } from "@/app/bible/_components/chapter-word-study"
import { ChapterVerseList } from "@/app/bible/_components/chapter-verse-list"
import { LexiconCacheProvider } from "@/app/bible/_components/lexicon-cache-context"
import {
  ChapterStudySidebar,
  type ChapterStudySelection,
} from "@/app/bible/_components/chapter-study-sidebar"
import type { VerseRange } from "@/lib/bible/reference"
import type { BibleTranslation } from "@/lib/bible/translations"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import type { StrongsWordAndCode } from "@/lib/bible/verse-strongs"

const DISMISS_THRESHOLD = 60

type BookInfo = { slug: string; name: string }
type ChapterOption = { id: string; number: number }

function MobileChapterStudySheet({
  bookSlug,
  chapterNumber,
  selection,
  hasStrongsForChapter,
  hasGreekMorph,
  onDismiss,
}: {
  bookSlug: string
  chapterNumber: number
  selection: ChapterStudySelection
  hasStrongsForChapter: boolean
  hasGreekMorph: boolean
  onDismiss: () => void
}) {
  const sheetY = useMotionValue(0)
  const backdropOpacity = useTransform(sheetY, [0, 300], [1, 0])
  const dragControls = useDragControls()

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > DISMISS_THRESHOLD || info.velocity.y > 300) {
        onDismiss()
      }
    },
    [onDismiss],
  )

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ opacity: backdropOpacity }}
        className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onDismiss}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        style={{ y: sheetY }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.8 }}
        onDragEnd={handleDragEnd}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0c] border-t border-white/10 rounded-t-[20px] max-h-[75vh] flex flex-col shadow-[0_-4px_40px_rgba(0,0,0,0.5)]"
        data-lenis-prevent
      >
        <div
          className="shrink-0 flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="w-14 h-1.5 rounded-full bg-white/30 active:bg-white/50 transition-colors" />
        </div>
        <div
          className="shrink-0 px-5 pb-3 flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <p className="font-mono text-[11px] tracking-[0.2em] text-amber-200/80 uppercase truncate">
            {selection?.kind === "strongs"
              ? `KJV · Strong's · ${selection.code}`
              : selection?.kind === "greekMorph"
                ? `Greek grammar · v.${selection.verse}`
                : "Word study"}
          </p>
          <div onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/8 active:bg-white/15 transition-colors"
              aria-label="Close word study"
            >
              <X className="size-3.5 text-white/60" />
            </button>
          </div>
        </div>
        <div className="mx-5 h-px bg-white/8" />
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <ChapterStudySidebar
            bookSlug={bookSlug}
            chapterNumber={chapterNumber}
            selection={selection}
            hasStrongsForChapter={hasStrongsForChapter}
            hasGreekMorph={hasGreekMorph}
          />
        </div>
        <div className="shrink-0 flex items-center justify-center gap-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
          <ChevronDown className="size-3 text-white/25" />
          <span className="font-mono text-[9px] tracking-widest text-white/25 uppercase">
            Drag down to close
          </span>
        </div>
      </motion.div>
    </>
  )
}

function MobileChapterStudyPill({ selection, onTap }: { selection: ChapterStudySelection; onTap: () => void }) {
  const label =
    selection?.kind === "strongs"
      ? `Strong's · ${selection.code}`
      : selection?.kind === "greekMorph"
        ? `Greek · v.${selection.verse}`
        : "Word study"
  return (
    <motion.button
      initial={{ y: 20, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      type="button"
      onClick={onTap}
      className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#1a1a1a] border border-white/15 rounded-full pl-3.5 pr-4 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
    >
      <span className="font-mono text-[11px] tracking-wider text-amber-200/90 uppercase whitespace-nowrap">
        {label}
      </span>
    </motion.button>
  )
}

export type BibleChapterShellProps = {
  book: BookInfo
  chapterNumber: number
  chapters: ChapterOption[]
  verses: { number: number; text: string }[]
  highlightRange: VerseRange | null
  /** When true, KJV-aligned per-word Strong's UI is shown (sidebar, clickable words). */
  kjvWordStudyEnabled: boolean
  /** KJV word + Strong's code per verse; only used when kjvWordStudyEnabled. */
  strongsWordsByVerse: Record<number, StrongsWordAndCode[]>
  keyTerms: string[]
  previousChapter: ChapterOption | null
  nextChapter: ChapterOption | null
  query: string
  errorMessage: string | null
  translations: BibleTranslation[]
  activeKey: string | null
  /** HCSB (and other local) footnotes: verse number, marker, text; optional kind/target for cross-ref links. */
  footnotes?: {
    verseNumber: number
    marker: string
    text: string
    kind?: string | null
    targetBookSlug?: string | null
    targetChapter?: number | null
    targetVerse?: number | null
  }[]
  /** Greek morphology tokens per verse (MorphGNT pilot: John 1). */
  greekMorphByVerse?: Record<number, GreekMorphToken[]>
}

function ChapterBody({
  book,
  chapterNumber,
  chapters,
  verses,
  highlightRange,
  kjvWordStudyEnabled,
  strongsWordsByVerse,
  keyTerms,
  previousChapter,
  nextChapter,
  query,
  errorMessage,
  translations,
  activeKey,
  footnotes,
  greekMorphByVerse = {},
  onSelectStrongs,
  studySelection,
  onSelectGreekMorph,
}: BibleChapterShellProps & {
  onSelectStrongs?: (code: string) => void
  studySelection?: ChapterStudySelection
  onSelectGreekMorph?: (verseNumber: number, wordIndex: number) => void
}) {
  const hasStrongsForChapter =
    kjvWordStudyEnabled && Object.values(strongsWordsByVerse).some((pairs) => pairs.length > 0)
  const hasGreekMorph = Object.keys(greekMorphByVerse).length > 0

  return (
    <>
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
            fallback={<div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">...</div>}
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

      {!kjvWordStudyEnabled && verses.length > 0 && !hasGreekMorph && (
        <p className="text-[11px] sm:text-xs leading-relaxed text-muted-foreground border border-border/60 bg-muted/15 rounded-md px-3 py-2">
          Per-word Greek and Hebrew (Strong&apos;s) in the verse text is only available when you select{" "}
          <span className="text-foreground/90">King James Version</span> in the translation menu. Other translations
          show the reader text without that layer.
        </p>
      )}

      {hasGreekMorph && verses.length > 0 && (
        <p className="text-[11px] sm:text-xs leading-relaxed text-muted-foreground border border-amber-500/25 bg-amber-500/5 rounded-md px-3 py-2">
          <span className="text-foreground/90 font-medium">Greek grammar (pilot):</span> the line under each verse is
          the Greek text (SBL) in sentence order. Tap a word for parsing and short grammar notes. This is separate from
          KJV Strong&apos;s alignment (English word order).
        </p>
      )}

      {kjvWordStudyEnabled && hasStrongsForChapter && verses.length > 0 && (
        <p className="text-[11px] sm:text-xs leading-relaxed text-muted-foreground border border-border/60 bg-muted/20 rounded-md px-3 py-2">
          <span className="text-foreground/90 font-medium">King James Version:</span> clickable words use KJV wording
          for Strong&apos;s alignment. Greek and Hebrew definitions come from the lexicon and may use different English
          than the verse (e.g. modern &quot;you&quot; vs &quot;ye&quot;).
        </p>
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
          strongsWordsByVerse={kjvWordStudyEnabled ? strongsWordsByVerse : {}}
          onSelectStrongs={kjvWordStudyEnabled ? onSelectStrongs : undefined}
          greekMorphByVerse={greekMorphByVerse}
          studySelection={studySelection}
          onSelectGreekMorph={onSelectGreekMorph}
          footnotes={footnotes}
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
    </>
  )
}

export function BibleChapterShell(props: BibleChapterShellProps) {
  const { kjvWordStudyEnabled, strongsWordsByVerse, greekMorphByVerse = {}, book, chapterNumber } = props

  const [selection, setSelection] = useState<ChapterStudySelection>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const hasStrongsForChapter =
    kjvWordStudyEnabled && Object.values(strongsWordsByVerse).some((pairs) => pairs.length > 0)
  const hasGreekMorph = Object.keys(greekMorphByVerse).length > 0
  const useStudyLayout = kjvWordStudyEnabled || hasGreekMorph
  const needsLexiconProvider = kjvWordStudyEnabled

  const onSelectStrongs = useCallback((code: string) => {
    setSelection({ kind: "strongs", code })
    setSheetOpen(true)
  }, [])

  const onSelectGreekMorph = useCallback((verseNumber: number, wordIndex: number) => {
    setSelection({ kind: "greekMorph", verse: verseNumber, wordIndex })
    setSheetOpen(true)
  }, [])

  const onDismissSheet = useCallback(() => setSheetOpen(false), [])
  const onReopenSheet = useCallback(() => setSheetOpen(true), [])

  const studyMain = (
    <main className="min-h-screen bg-background text-foreground">
      {props.highlightRange && <ScrollToVerse verseNumber={props.highlightRange.start} />}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-6 px-4 pb-16 pt-[var(--navbar-offset)] lg:max-w-none lg:flex-row lg:gap-12 lg:items-start lg:pr-[22rem]">
        <div className="min-w-0 flex-1 flex flex-col gap-4 sm:gap-6">
          <ChapterBody
            {...props}
            onSelectStrongs={kjvWordStudyEnabled ? onSelectStrongs : undefined}
            studySelection={selection}
            onSelectGreekMorph={hasGreekMorph ? onSelectGreekMorph : undefined}
          />
        </div>

        <aside
          className="hidden lg:flex lg:flex-col lg:fixed lg:right-0 lg:top-[var(--navbar-offset)] lg:w-[22rem] lg:max-h-[calc(100dvh-var(--navbar-offset)-1rem)] bg-[#050505] z-10 pt-6"
          aria-label="Scripture word study and Greek grammar"
        >
          <div className="shrink-0 px-6 pb-2">
            <p className="font-mono text-xs tracking-[0.25em] text-white/50 uppercase">
              {kjvWordStudyEnabled && hasGreekMorph
                ? "KJV · Strong's · Greek grammar"
                : kjvWordStudyEnabled
                  ? "KJV · Greek & Hebrew"
                  : "Greek grammar"}
            </p>
          </div>
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6"
            style={{ WebkitOverflowScrolling: "touch" }}
            data-lenis-prevent
          >
            <ChapterStudySidebar
              bookSlug={book.slug}
              chapterNumber={chapterNumber}
              selection={selection}
              hasStrongsForChapter={hasStrongsForChapter}
              hasGreekMorph={hasGreekMorph}
            />
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {sheetOpen && selection && (
          <MobileChapterStudySheet
            key={
              selection.kind === "strongs"
                ? `s-${selection.code}`
                : `g-${selection.verse}-${selection.wordIndex}`
            }
            bookSlug={book.slug}
            chapterNumber={chapterNumber}
            selection={selection}
            hasStrongsForChapter={hasStrongsForChapter}
            hasGreekMorph={hasGreekMorph}
            onDismiss={onDismissSheet}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!sheetOpen && selection && (
          <MobileChapterStudyPill selection={selection} onTap={onReopenSheet} />
        )}
      </AnimatePresence>
    </main>
  )

  if (!useStudyLayout) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        {props.highlightRange && <ScrollToVerse verseNumber={props.highlightRange.start} />}
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-6 px-4 pb-16 pt-[var(--navbar-offset)]">
          <div className="min-w-0 flex flex-col gap-4 sm:gap-6">
            <ChapterBody {...props} />
          </div>
        </div>
      </main>
    )
  }

  if (needsLexiconProvider) {
    return <LexiconCacheProvider>{studyMain}</LexiconCacheProvider>
  }

  return studyMain
}
