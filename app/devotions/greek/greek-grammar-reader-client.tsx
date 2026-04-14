"use client"

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Gamepad2, Menu, Sparkles, X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { GreekCoachLab } from "@/app/devotions/greek/greek-coach-lab"
import { GreekGrammarPrimer } from "@/app/bible/_components/greek-grammar-primer"
import { MorphologySidebarPanel } from "@/app/bible/_components/morphology-sidebar"
import { buildGreekWordLearningClues } from "@/lib/bible/greek-word-learning-clues"
import { getMorphHintAbbrev } from "@/lib/bible/greek-morph-hints"
import { recordGreekStudyEvent } from "@/lib/devotions-greek-progress"
import { MORPH_PILOT_CHAPTERS } from "@/lib/bible/morph-pilot-menu"
import { useGreekUiPreferences } from "@/lib/devotions-greek-ui-preferences"

import {
  DETAIL_SWIPE_CLOSE_THRESHOLD,
  DETAIL_SWIPE_CLOSE_VELOCITY,
  MENU_SWIPE_CLOSE_THRESHOLD,
  useGreekPilotVerse,
  VERSE_SWIPE_HORIZONTAL_RATIO,
  VERSE_SWIPE_MIN_X,
} from "@/app/devotions/greek/greek-pilot-verse-shared"

export function GreekGrammarReaderClient() {
  const {
    pilot,
    passageRef,
    readerUrl,
    hydrated,
    loading,
    error,
    english,
    greekTokens,
    verse,
    prevVerse,
    nextVerse,
    rolodexBookSlug,
    setRolodexBookSlug,
    rolodexChapter,
    setRolodexChapter,
    rolodexVerse,
    setRolodexVerse,
    rolodexBooks,
    rolodexChapters,
    selectedRolodexChapter,
    rolodexVerseOptions,
    applyRolodexSelection,
  } = useGreekPilotVerse()

  const [menuOpen, setMenuOpen] = useState(false)
  const { prefs: uiPrefs, updatePrefs: updateUiPrefs } = useGreekUiPreferences()
  const { wordHintsEnabled, showEnglish } = uiPrefs
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null)

  const verseProgress = `${Math.max(3, (verse / pilot.maxVerse) * 100)}%`

  const verseSwipeStartX = useRef<number | null>(null)
  const verseSwipeStartY = useRef<number | null>(null)
  const menuSwipeStartY = useRef<number | null>(null)
  const menuSwipeCurrentY = useRef<number | null>(null)
  const detailSwipeStartY = useRef<number | null>(null)
  const detailSwipeCurrentY = useRef<number | null>(null)
  const detailSwipeStartX = useRef<number | null>(null)
  const detailSwipeCurrentX = useRef<number | null>(null)
  const detailSwipeStartedAt = useRef<number | null>(null)
  const detailContentRef = useRef<HTMLDivElement | null>(null)
  const [detailDragOffsetY, setDetailDragOffsetY] = useState(0)

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeDetails = useCallback(() => setSelectedWordIndex(null), [])

  const awardCoachProgress = useCallback((event: Parameters<typeof recordGreekStudyEvent>[0]) => {
    return recordGreekStudyEvent(event).awardedXp
  }, [])

  useEffect(() => {
    if (selectedWordIndex == null) setDetailDragOffsetY(0)
  }, [selectedWordIndex])

  const jumpToRolodex = useCallback(() => {
    applyRolodexSelection()
    closeMenu()
  }, [applyRolodexSelection, closeMenu])

  const handleSelectGreekWord = useCallback((wordIndex: number) => {
    setSelectedWordIndex(wordIndex)
  }, [])

  const onVerseTouchStart = useCallback((e: TouchEvent) => {
    verseSwipeStartX.current = e.changedTouches[0]?.clientX ?? null
    verseSwipeStartY.current = e.changedTouches[0]?.clientY ?? null
  }, [])

  const onVerseTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (menuOpen || selectedWordIndex != null) return
      const start = verseSwipeStartX.current
      const startY = verseSwipeStartY.current
      verseSwipeStartX.current = null
      verseSwipeStartY.current = null
      if (start == null || startY == null) return
      const end = e.changedTouches[0]?.clientX
      const endY = e.changedTouches[0]?.clientY
      if (end == null || endY == null) return
      const dx = end - start
      const dy = endY - startY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const mostlyHorizontal = absDx >= absDy * VERSE_SWIPE_HORIZONTAL_RATIO
      if (!mostlyHorizontal || absDx < VERSE_SWIPE_MIN_X) return
      if (dx > 0) prevVerse()
      else nextVerse()
    },
    [menuOpen, selectedWordIndex, prevVerse, nextVerse],
  )

  const onMenuTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const y = e.changedTouches[0]?.clientY
    if (typeof y !== "number") return
    menuSwipeStartY.current = y
    menuSwipeCurrentY.current = y
  }, [])

  const onMenuTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const y = e.changedTouches[0]?.clientY
    if (typeof y !== "number") return
    menuSwipeCurrentY.current = y
  }, [])

  const onMenuTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const startY = menuSwipeStartY.current
      const endY = menuSwipeCurrentY.current ?? e.changedTouches[0]?.clientY ?? null
      menuSwipeStartY.current = null
      menuSwipeCurrentY.current = null
      if (startY == null || endY == null) return
      if (endY - startY > MENU_SWIPE_CLOSE_THRESHOLD) closeMenu()
    },
    [closeMenu],
  )

  const onDetailTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const y = e.changedTouches[0]?.clientY
    const x = e.changedTouches[0]?.clientX
    if (typeof y !== "number" || typeof x !== "number") return
    detailSwipeStartY.current = y
    detailSwipeCurrentY.current = y
    detailSwipeStartX.current = x
    detailSwipeCurrentX.current = x
    detailSwipeStartedAt.current = Date.now()
  }, [])

  const onDetailTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const y = e.changedTouches[0]?.clientY
      const x = e.changedTouches[0]?.clientX
      if (typeof y !== "number" || typeof x !== "number") return
      detailSwipeCurrentY.current = y
      detailSwipeCurrentX.current = x
      const startY = detailSwipeStartY.current
      const startX = detailSwipeStartX.current
      if (startY == null || startX == null) return
      const deltaY = y - startY
      const deltaX = Math.abs(x - startX)
      const atTop = (detailContentRef.current?.scrollTop ?? 0) <= 4
      const mostlyVertical = deltaY > 0 && deltaY > deltaX * 1.15
      if (atTop && mostlyVertical) {
        setDetailDragOffsetY(Math.min(170, deltaY * 0.85))
      } else if (detailDragOffsetY !== 0) {
        setDetailDragOffsetY(0)
      }
    },
    [detailDragOffsetY],
  )

  const onDetailTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const startY = detailSwipeStartY.current
      const endY = detailSwipeCurrentY.current ?? e.changedTouches[0]?.clientY ?? null
      const startX = detailSwipeStartX.current
      const endX = detailSwipeCurrentX.current ?? e.changedTouches[0]?.clientX ?? null
      const startedAt = detailSwipeStartedAt.current
      detailSwipeStartY.current = null
      detailSwipeCurrentY.current = null
      detailSwipeStartX.current = null
      detailSwipeCurrentX.current = null
      detailSwipeStartedAt.current = null
      if (startY == null || endY == null || startX == null || endX == null) return
      const deltaY = endY - startY
      const deltaX = Math.abs(endX - startX)
      const atTop = (detailContentRef.current?.scrollTop ?? 0) <= 4
      const elapsedMs = startedAt == null ? 999 : Math.max(1, Date.now() - startedAt)
      const velocity = deltaY / elapsedMs
      const shouldClose =
        atTop &&
        deltaY > 0 &&
        deltaY > deltaX * 1.15 &&
        (deltaY > DETAIL_SWIPE_CLOSE_THRESHOLD || velocity > DETAIL_SWIPE_CLOSE_VELOCITY)
      if (shouldClose) closeDetails()
      setDetailDragOffsetY(0)
    },
    [closeDetails],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedWordIndex != null) closeDetails()
        else closeMenu()
      } else if (e.key === "ArrowLeft" && !menuOpen && selectedWordIndex == null) {
        e.preventDefault()
        prevVerse()
      } else if (e.key === "ArrowRight" && !menuOpen && selectedWordIndex == null) {
        e.preventDefault()
        nextVerse()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen, selectedWordIndex, closeMenu, closeDetails, prevVerse, nextVerse])

  const selectedToken =
    selectedWordIndex != null && selectedWordIndex >= 0 ? greekTokens[selectedWordIndex] ?? null : null
  const levelKey = `${pilot.bookSlug}-${pilot.chapter}-${verse}`
  const verseGreekLine = greekTokens.map((t) => t.word).join(" ")

  return (
    <div className="fixed inset-0 z-[60] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#172033,transparent_44%),linear-gradient(to_bottom,#05070f,#030407,#010103)] text-white">
      <header className="relative z-[72] shrink-0 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 sm:px-5 pt-[max(0.55rem,env(safe-area-inset-top))] pb-2">
          <Link
            href="/devotions"
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
          <div className="text-center min-w-0 px-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300/70">Grammar reader</p>
            <p className="text-sm text-white/80 truncate">{pilot.label}</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
            aria-label="Open study controls"
          >
            <Menu className="size-3.5" />
            Menu
          </button>
        </div>
        <div className="flex justify-center pb-2 px-3">
          <Link
            href="/devotions/greek/quest"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-200/90 hover:bg-emerald-500/20"
          >
            <Gamepad2 className="size-3.5" />
            Verse Quest
          </Link>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[78] bg-black/65 px-3 pt-[max(4.75rem,calc(env(safe-area-inset-top)+4.35rem))] backdrop-blur-sm sm:px-6"
            onClick={closeMenu}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.985 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mx-auto w-full max-w-2xl rounded-3xl border border-white/20 bg-[#0a1020]/95 p-4 sm:p-5"
              role="dialog"
              aria-label="Study controls"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={onMenuTouchStart}
              onTouchMove={onMenuTouchMove}
              onTouchEnd={onMenuTouchEnd}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-200/80">
                  <Sparkles className="size-3.5" />
                  Verse controls
                </p>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white/75 hover:bg-white/[0.12]"
                  aria-label="Close study controls"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/15 bg-black/25 p-3 sm:p-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Verse rolodex</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/45">Book</span>
                      <select
                        value={rolodexBookSlug}
                        onChange={(e) => {
                          const nextBook = e.target.value
                          const firstChapter = MORPH_PILOT_CHAPTERS.find((item) => item.bookSlug === nextBook)
                          setRolodexBookSlug(nextBook)
                          if (firstChapter) {
                            setRolodexChapter(firstChapter.chapter)
                            setRolodexVerse((current) => Math.min(current, firstChapter.maxVerse))
                          }
                        }}
                        className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 font-mono text-sm text-white focus:border-amber-300/50 focus:outline-none"
                        aria-label="Select Greek study book"
                      >
                        {rolodexBooks.map((item) => (
                          <option key={item.bookSlug} value={item.bookSlug}>
                            {item.bookName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/45">Chapter</span>
                      <select
                        value={rolodexChapter}
                        onChange={(e) => {
                          const nextChapter = Number.parseInt(e.target.value, 10)
                          const chapterItem = rolodexChapters.find((item) => item.chapter === nextChapter)
                          setRolodexChapter(nextChapter)
                          if (chapterItem) {
                            setRolodexVerse((current) => Math.min(current, chapterItem.maxVerse))
                          }
                        }}
                        className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 font-mono text-sm text-white focus:border-amber-300/50 focus:outline-none"
                        aria-label="Select Greek study chapter"
                      >
                        {rolodexChapters.map((item) => (
                          <option key={`${item.bookSlug}-${item.chapter}`} value={item.chapter}>
                            {item.chapter}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/45">Verse</span>
                      <select
                        value={rolodexVerse}
                        onChange={(e) => setRolodexVerse(Number.parseInt(e.target.value, 10))}
                        className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 font-mono text-sm text-white focus:border-amber-300/50 focus:outline-none"
                        aria-label="Select Greek study verse"
                      >
                        {rolodexVerseOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
                      {selectedRolodexChapter.label}:{rolodexVerse}
                    </p>
                    <button
                      type="button"
                      onClick={jumpToRolodex}
                      className="rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100 hover:bg-amber-400/25"
                    >
                      Go to verse
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateUiPrefs({ wordHintsEnabled: !wordHintsEnabled })}
                    className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                      wordHintsEnabled
                        ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                        : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                    }`}
                  >
                    {wordHintsEnabled ? "Hints On" : "Hints Off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateUiPrefs({ showEnglish: !showEnglish })}
                    className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                      showEnglish
                        ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                        : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                    }`}
                  >
                    {showEnglish ? "English On" : "English Off"}
                  </button>
                  <Link
                    href={readerUrl}
                    onClick={closeMenu}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
                  >
                    Full Reader
                    <ExternalLink className="size-3.5 opacity-70" />
                  </Link>
                  <Link
                    href="/devotions/greek/quest"
                    onClick={closeMenu}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-200/90 hover:bg-emerald-500/20"
                  >
                    Verse Quest
                    <Gamepad2 className="size-3.5 opacity-80" />
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={closeMenu}
                  className="w-full rounded-2xl border border-white/20 bg-white/[0.04] py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/80 hover:bg-white/[0.1]"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-28 pt-5 sm:px-8 md:px-14"
        onTouchStart={onVerseTouchStart}
        onTouchEnd={onVerseTouchEnd}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6">
          <div className="flex shrink-0 flex-col gap-6">
          <GreekGrammarPrimer
            persistBehavior="devotions"
            className="rounded-xl border border-amber-500/25 bg-black/20 p-3 sm:p-4 [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white"
            wordHintsEnabled={wordHintsEnabled}
            onToggleWordHints={() => updateUiPrefs({ wordHintsEnabled: !wordHintsEnabled })}
          />

          <div className="space-y-2 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-300/75">{passageRef.replace(":", " · ")}</p>
            <div className="mx-auto h-1 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300/80 to-emerald-300/80"
                style={{ width: verseProgress }}
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
              Verse {verse} of {pilot.maxVerse}
            </p>
          </div>

          {error ? <p className="text-center text-sm text-red-300/90">{error}</p> : null}
          </div>

          <section className="flex min-h-[56vh] sm:min-h-[60vh] flex-col items-center justify-start sm:justify-center pt-3 sm:pt-0">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full max-w-3xl space-y-4 animate-pulse"
                >
                  <div className="h-10 rounded-xl bg-white/10" />
                  <div className="h-10 rounded-xl bg-white/10" />
                  <div className="h-10 rounded-xl bg-white/10" />
                </motion.div>
              ) : greekTokens.length > 0 ? (
                <motion.div
                  key={`${pilot.bookSlug}-${pilot.chapter}-${verse}`}
                  initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(3px)" }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  lang="el"
                  className="w-full text-center leading-[1.28] text-amber-100/95 flex flex-wrap justify-center gap-x-3 gap-y-4"
                  style={{ fontSize: "clamp(2.25rem, 8.4vw, 6rem)" }}
                >
                  {greekTokens.map((tok, wi) => {
                    const selected = selectedWordIndex === wi
                    const hint = wordHintsEnabled ? getMorphHintAbbrev(tok) : null
                    return (
                      <span key={`${verse}-${wi}-${tok.word}`} className="inline-flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => handleSelectGreekWord(wi)}
                          className={
                            selected
                              ? "border-b-2 border-amber-300/85 text-amber-200"
                              : "border-b border-dashed border-amber-300/55 text-amber-100/95 hover:border-amber-300/80 hover:text-amber-50"
                          }
                        >
                          {tok.word}
                        </button>
                        {hint ? (
                          <span className="mt-0.5 font-mono text-[9px] sm:text-[10px] text-amber-400/70">{hint}</span>
                        ) : null}
                      </span>
                    )
                  })}
                </motion.div>
              ) : (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm text-white/45"
                >
                  Greek text unavailable for this verse.
                </motion.p>
              )}
            </AnimatePresence>
          </section>

          {showEnglish && english ? (
            <p
              className="mx-auto max-w-3xl shrink-0 border-t border-white/10 pt-5 text-center text-white/70 leading-relaxed"
              style={{ fontSize: "clamp(1.05rem, 3.3vw, 1.6rem)" }}
            >
              {english}
            </p>
          ) : null}
        </div>
      </main>

      <AnimatePresence>
        {selectedToken ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[66] flex min-h-0 items-end"
          >
            <button
              type="button"
              aria-label="Close word details"
              className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
              onClick={closeDetails}
            />
            <motion.section
              initial={{ y: "100%" }}
              animate={{ y: detailDragOffsetY }}
              exit={{ y: "100%" }}
              transition={detailDragOffsetY > 0 ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 360 }}
              className="relative z-[67] flex w-full max-h-[min(72dvh,640px)] flex-col overflow-hidden rounded-t-3xl border-t border-white/20 bg-[#060b14]/95"
            >
              <div
                className="shrink-0 border-b border-white/10 px-4 pb-3 pt-3 sm:px-6"
                onTouchStart={onDetailTouchStart}
                onTouchMove={onDetailTouchMove}
                onTouchEnd={onDetailTouchEnd}
                onTouchCancel={() => {
                  detailSwipeStartY.current = null
                  detailSwipeCurrentY.current = null
                  detailSwipeStartX.current = null
                  detailSwipeCurrentX.current = null
                  detailSwipeStartedAt.current = null
                  setDetailDragOffsetY(0)
                }}
              >
                <div
                  data-detail-swipe-handle
                  className="mb-2 flex flex-col items-center gap-1.5 pb-1 text-center select-none"
                >
                  <div className="h-1.5 w-14 rounded-full bg-white/25" />
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Swipe down from here to close</p>
                </div>
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Greek · Word</p>
                    <p className="mt-0.5 text-sm text-white/80" lang="el">
                      {selectedToken.word}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDetails}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white/70 hover:bg-white/[0.12]"
                    aria-label="Close word details"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <div
                ref={detailContentRef}
                className="mx-auto min-h-0 w-full max-w-4xl max-h-[calc(min(72dvh,640px)-9.25rem)] overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-1 [-webkit-overflow-scrolling:touch] sm:px-6"
              >
                <MorphologySidebarPanel token={selectedToken} verseNumber={verse} wordIndex={selectedWordIndex ?? 0} />

                <GreekCoachLab
                  key={`${levelKey}-lab-${selectedWordIndex}`}
                  levelKey={levelKey}
                  passageRef={passageRef}
                  english={english}
                  verseGreekLine={verseGreekLine}
                  selectedToken={selectedToken}
                  wordIndex={selectedWordIndex ?? 0}
                  learningClues={buildGreekWordLearningClues(selectedToken)}
                  awardProgress={awardCoachProgress}
                  className="mt-6"
                />
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <footer className="relative z-[62] shrink-0 border-t border-white/10 bg-black/30 backdrop-blur-xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-lg gap-3">
          <button
            type="button"
            onClick={prevVerse}
            disabled={verse <= 1 || loading}
            className="flex-1 min-h-[52px] rounded-xl border border-white/20 bg-white/[0.04] font-mono text-xs uppercase tracking-[0.16em] text-white/90 hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-40 inline-flex items-center justify-center gap-1"
            aria-label="Previous verse"
          >
            <ChevronLeft className="size-5" />
            Prev
          </button>
          <button
            type="button"
            onClick={nextVerse}
            disabled={verse >= pilot.maxVerse || loading}
            className="flex-1 min-h-[52px] rounded-xl border border-white/20 bg-white/[0.04] font-mono text-xs uppercase tracking-[0.16em] text-white/90 hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-40 inline-flex items-center justify-center gap-1"
            aria-label="Next verse"
          >
            Next
            <ChevronRight className="size-5" />
          </button>
        </div>
        <Link
          href={readerUrl}
          className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-amber-300/90 hover:text-amber-200"
        >
          Word study &amp; grammar in full chapter
          <ExternalLink className="size-3.5 opacity-80" />
        </Link>
      </footer>
    </div>
  )
}
