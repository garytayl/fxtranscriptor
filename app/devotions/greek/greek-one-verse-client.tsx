"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Menu, Sparkles, X } from "lucide-react"

import { MorphologySidebarPanel } from "@/app/bible/_components/morphology-sidebar"
import { getMorphHintAbbrev } from "@/lib/bible/greek-morph-hints"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { expandGreekMorphToken } from "@/lib/bible/robinson-greek"
import {
  MORPH_PILOT_CHAPTERS,
  morphPilotPassageRef,
  morphPilotReaderUrl,
  type MorphPilotChapterMenuItem,
} from "@/lib/bible/morph-pilot-menu"
import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"

const STORAGE_KEY = "fx_devotions_greek_place_v1"
const SWIPE_CLOSE_THRESHOLD = 68

type StoredPlace = { bookSlug: string; chapter: number; verse: number }
type PassageVerse = { number: number; text: string }
type GreekCoachPayload = { insight: string; prayerPrompt: string }

function loadPlace(): StoredPlace | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as StoredPlace
    if (!p?.bookSlug || typeof p.chapter !== "number" || typeof p.verse !== "number") return null
    return p
  } catch {
    return null
  }
}

function savePlace(p: StoredPlace) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, "")
}

export function GreekOneVerseClient() {
  const [pilotIdx, setPilotIdx] = useState(0)
  const [verse, setVerse] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [verseDraft, setVerseDraft] = useState("1")
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [english, setEnglish] = useState("")
  const [greekTokens, setGreekTokens] = useState<GreekMorphToken[]>([])
  const [wordHintsEnabled, setWordHintsEnabled] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [coachPayload, setCoachPayload] = useState<GreekCoachPayload | null>(null)
  const [coachTokenKey, setCoachTokenKey] = useState<string | null>(null)

  const pilot: MorphPilotChapterMenuItem = MORPH_PILOT_CHAPTERS[pilotIdx] ?? MORPH_PILOT_CHAPTERS[0]
  const passageRef = useMemo(() => morphPilotPassageRef(pilot, verse), [pilot, verse])
  const readerUrl = useMemo(
    () => morphPilotReaderUrl(pilot.bookSlug, pilot.chapter, verse),
    [pilot.bookSlug, pilot.chapter, verse],
  )
  const verseProgress = `${Math.max(3, (verse / pilot.maxVerse) * 100)}%`

  const verseSwipeStartX = useRef<number | null>(null)
  const menuSwipeStartY = useRef<number | null>(null)
  const menuSwipeCurrentY = useRef<number | null>(null)
  const detailSwipeStartY = useRef<number | null>(null)
  const detailSwipeCurrentY = useRef<number | null>(null)

  useEffect(() => {
    const s = loadPlace()
    if (s) {
      const idx = MORPH_PILOT_CHAPTERS.findIndex(
        (c) => c.bookSlug === s.bookSlug && c.chapter === s.chapter,
      )
      if (idx >= 0) {
        setPilotIdx(idx)
        const max = MORPH_PILOT_CHAPTERS[idx].maxVerse
        setVerse(Math.min(Math.max(1, s.verse), max))
      }
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    savePlace({ bookSlug: pilot.bookSlug, chapter: pilot.chapter, verse })
  }, [hydrated, pilot.bookSlug, pilot.chapter, verse])

  useEffect(() => {
    setVerseDraft(String(verse))
  }, [verse])

  useEffect(() => {
    if (!hydrated) return

    const controller = new AbortController()
    const ref = passageRef
    const t = FX_GREEK_GRAMMAR_TRANSLATION_KEY

    setLoading(true)
    setError(null)
    setSelectedWordIndex(null)

    const load = async () => {
      try {
        const [passRes, morphRes] = await Promise.all([
          fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(t)}`, {
            signal: controller.signal,
          }),
          fetch(`/api/bible/morph?ref=${encodeURIComponent(ref)}`, { signal: controller.signal }),
        ])
        const pass = (await passRes.json()) as Record<string, unknown>
        const morph = (await morphRes.json()) as Record<string, unknown>

        let passError: string | null = null
        let nextEnglish = ""
        if (!passRes.ok) {
          passError = typeof pass.error === "string" ? pass.error : "Could not load this verse."
        } else if (typeof pass.error === "string" && pass.error) {
          passError = pass.error
        } else {
          const verses = pass.verses as PassageVerse[] | undefined
          const row = verses?.find((v) => v.number === verse) ?? verses?.[0]
          nextEnglish = row?.text ? stripHtmlTags(row.text).replace(/\s+/g, " ").trim() : ""
        }

        let morphError: string | null = null
        let nextGreekTokens: GreekMorphToken[] = []
        if (!morphRes.ok) {
          morphError = typeof morph.error === "string" ? morph.error : "Could not load Greek morphology."
        } else if (typeof morph.error === "string" && morph.error && morph.available === false) {
          morphError = morph.error
        } else {
          const mVerses = morph.verses as { number: number; tokens: GreekMorphToken[] }[] | undefined
          const mv = mVerses?.find((x) => x.number === verse) ?? mVerses?.[0]
          nextGreekTokens = mv?.tokens ?? []
          if (nextGreekTokens.length === 0) morphError = "Could not load Greek morphology."
        }

        setEnglish(nextEnglish)
        setGreekTokens(nextGreekTokens)
        if (passError && nextGreekTokens.length > 0) {
          setError("English translation unavailable right now. Greek grammar study is still available.")
        } else if (!passError && morphError && nextEnglish) {
          setError("Greek morphology unavailable for this verse.")
        } else if (passError) {
          setError(passError)
        } else if (morphError) {
          setError(morphError)
        } else {
          setError(null)
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError("Could not load this verse.")
        setEnglish("")
        setGreekTokens([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [hydrated, passageRef, verse])

  const prevVerse = useCallback(() => {
    setVerse((v) => Math.max(1, v - 1))
  }, [])

  const nextVerse = useCallback(() => {
    setVerse((v) => Math.min(pilot.maxVerse, v + 1))
  }, [pilot.maxVerse])

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeDetails = useCallback(() => setSelectedWordIndex(null), [])

  const selectPilot = useCallback((idx: number) => {
    setPilotIdx(idx)
    setVerse(1)
    closeMenu()
  }, [closeMenu])

  const jumpToVerse = useCallback(() => {
    const num = Number.parseInt(verseDraft.trim(), 10)
    if (!Number.isFinite(num)) return
    setVerse(Math.min(pilot.maxVerse, Math.max(1, num)))
    closeMenu()
  }, [pilot.maxVerse, verseDraft, closeMenu])

  const handleSelectGreekWord = useCallback((wordIndex: number) => {
    setSelectedWordIndex((prev) => (prev === wordIndex ? null : wordIndex))
  }, [])

  const onVerseTouchStart = useCallback((e: TouchEvent) => {
    verseSwipeStartX.current = e.changedTouches[0]?.clientX ?? null
  }, [])

  const onVerseTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (menuOpen || selectedWordIndex != null) return
      const start = verseSwipeStartX.current
      verseSwipeStartX.current = null
      if (start == null) return
      const end = e.changedTouches[0]?.clientX
      if (end == null) return
      const dx = end - start
      if (dx > 56) prevVerse()
      else if (dx < -56) nextVerse()
    },
    [menuOpen, selectedWordIndex, prevVerse, nextVerse],
  )

  const selectedToken =
    selectedWordIndex != null && selectedWordIndex >= 0 ? greekTokens[selectedWordIndex] ?? null : null
  const selectedTokenExpanded = selectedToken ? expandGreekMorphToken(selectedToken) : null

  const activeTokenKey =
    selectedToken && selectedWordIndex != null
      ? `${pilot.bookSlug}-${pilot.chapter}-${verse}-${selectedWordIndex}-${selectedToken.word}`
      : null

  useEffect(() => {
    if (!activeTokenKey) {
      setCoachPayload(null)
      setCoachError(null)
      return
    }
    if (coachTokenKey === activeTokenKey) return
    setCoachPayload(null)
    setCoachError(null)
  }, [activeTokenKey, coachTokenKey])

  const runAiCoach = useCallback(async () => {
    if (!selectedToken || !activeTokenKey) return
    if (coachLoading) return
    if (coachTokenKey === activeTokenKey && coachPayload) return

    setCoachLoading(true)
    setCoachError(null)
    try {
      const response = await fetch("/api/devotions/greek-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: passageRef,
          english,
          greekWord: selectedToken.word,
          lemma: selectedToken.lemma,
          parse: selectedToken.parse,
          category: selectedTokenExpanded?.posLabel ?? selectedToken.pos,
          parseSummary: selectedTokenExpanded?.parseSummary ?? selectedToken.parse,
        }),
      })
      const data = (await response.json()) as
        | {
            insight?: string
            prayerPrompt?: string
            microGloss?: string
            grammarHook?: string
            reflectionPrompt?: string
            error?: string
          }
        | undefined
      const insight =
        data?.insight ??
        [data?.microGloss, data?.grammarHook]
          .filter((s): s is string => typeof s === "string" && s.length > 0)
          .join(" ")
      const prayerPrompt = data?.prayerPrompt ?? data?.reflectionPrompt
      if (!response.ok || !insight || !prayerPrompt) {
        throw new Error(data?.error || "Could not generate AI coach insight.")
      }
      setCoachPayload({
        insight: insight.trim(),
        prayerPrompt: prayerPrompt.trim(),
      })
      setCoachTokenKey(activeTokenKey)
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Could not generate AI coach insight.")
    } finally {
      setCoachLoading(false)
    }
  }, [
    selectedToken,
    selectedTokenExpanded,
    activeTokenKey,
    coachLoading,
    coachTokenKey,
    coachPayload,
    passageRef,
    english,
  ])

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
      if (endY - startY > SWIPE_CLOSE_THRESHOLD) closeMenu()
    },
    [closeMenu],
  )

  const onDetailTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const y = e.changedTouches[0]?.clientY
    if (typeof y !== "number") return
    detailSwipeStartY.current = y
    detailSwipeCurrentY.current = y
  }, [])

  const onDetailTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const y = e.changedTouches[0]?.clientY
    if (typeof y !== "number") return
    detailSwipeCurrentY.current = y
  }, [])

  const onDetailTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const startY = detailSwipeStartY.current
      const endY = detailSwipeCurrentY.current ?? e.changedTouches[0]?.clientY ?? null
      detailSwipeStartY.current = null
      detailSwipeCurrentY.current = null
      if (startY == null || endY == null) return
      if (endY - startY > SWIPE_CLOSE_THRESHOLD) closeDetails()
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

  return (
    <div className="fixed inset-0 z-[60] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#172033,transparent_44%),linear-gradient(to_bottom,#05070f,#030407,#010103)] text-white">
      <header className="shrink-0 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 sm:px-5 pt-[max(0.55rem,env(safe-area-inset-top))] pb-2">
          <Link
            href="/devotions"
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300/70">Greek Studio</p>
            <p className="text-sm text-white/80">{pilot.label}</p>
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
      </header>

      {menuOpen ? (
        <div
          className="absolute inset-0 z-[70] bg-black/65 px-3 pt-[max(4.75rem,calc(env(safe-area-inset-top)+4.35rem))] backdrop-blur-sm sm:px-6"
          onClick={closeMenu}
        >
          <div
            className="mx-auto w-full max-w-2xl rounded-3xl border border-white/20 bg-[#0a1020]/95 p-4 sm:p-5 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-label="Study controls"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onMenuTouchStart}
            onTouchMove={onMenuTouchMove}
            onTouchEnd={onMenuTouchEnd}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-200/80">
                <Sparkles className="size-3.5" />
                Study controls
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MORPH_PILOT_CHAPTERS.map((c, idx) => {
                  const active = idx === pilotIdx
                  return (
                    <button
                      key={`${c.bookSlug}-${c.chapter}`}
                      type="button"
                      onClick={() => selectPilot(idx)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-emerald-300/55 bg-emerald-400/20 text-emerald-100"
                          : "border-white/15 bg-white/[0.03] text-white/75 hover:bg-white/[0.08]"
                      }`}
                    >
                      <p className="font-sans text-sm font-medium">{c.label}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
                        {c.maxVerse} verses
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/25 p-3 sm:p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Jump to verse</p>
                <div className="flex gap-2">
                  <input
                    value={verseDraft}
                    onChange={(e) => setVerseDraft(e.target.value)}
                    inputMode="numeric"
                    className="flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2 font-mono text-sm text-white placeholder:text-white/35 focus:border-emerald-300/50 focus:outline-none"
                    placeholder={`1-${pilot.maxVerse}`}
                    aria-label="Verse number"
                  />
                  <button
                    type="button"
                    onClick={jumpToVerse}
                    className="rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-4 font-mono text-xs uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-400/25"
                  >
                    Go
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setWordHintsEnabled((v) => !v)}
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
                  onClick={() => setShowEnglish((v) => !v)}
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
              </div>

              <button
                type="button"
                onClick={closeMenu}
                className="w-full rounded-2xl border border-white/20 bg-white/[0.04] py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/80 hover:bg-white/[0.1]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main
        className="flex-1 min-h-0 overflow-y-auto px-4 pb-28 pt-5 sm:px-8 md:px-14"
        onTouchStart={onVerseTouchStart}
        onTouchEnd={onVerseTouchEnd}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="space-y-2 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300/75">
              {passageRef.replace(":", " · ")}
            </p>
            <div className="mx-auto h-1 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300/80 to-amber-300/80"
                style={{ width: verseProgress }}
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
              Verse {verse} of {pilot.maxVerse}
            </p>
          </div>

          {error ? <p className="text-center text-sm text-red-300/90">{error}</p> : null}

          <section className="min-h-[56vh] sm:min-h-[60vh] flex items-center justify-center">
            {loading ? (
              <div className="w-full max-w-3xl space-y-4 animate-pulse">
                <div className="h-10 rounded-xl bg-white/10" />
                <div className="h-10 rounded-xl bg-white/10" />
                <div className="h-10 rounded-xl bg-white/10" />
              </div>
            ) : greekTokens.length > 0 ? (
              <div
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
                            : "border-b border-dashed border-amber-300/35 text-amber-100/95 hover:border-amber-300/70 hover:text-amber-50"
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
              </div>
            ) : (
              <p className="text-center text-sm text-white/45">Greek text unavailable for this verse.</p>
            )}
          </section>

          {showEnglish && english ? (
            <p className="mx-auto max-w-3xl text-center text-white/70 leading-relaxed" style={{ fontSize: "clamp(1.05rem, 3.3vw, 1.6rem)" }}>
              {english}
            </p>
          ) : null}
        </div>
      </main>

      {selectedToken ? (
        <div className="absolute inset-0 z-[66] flex items-end">
          <button
            type="button"
            aria-label="Close word details"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={closeDetails}
          />
          <section
            className="relative z-[67] w-full rounded-t-3xl border-t border-white/20 bg-[#060b14]/95 shadow-[0_-20px_60px_rgba(0,0,0,0.55)]"
            onTouchStart={onDetailTouchStart}
            onTouchMove={onDetailTouchMove}
            onTouchEnd={onDetailTouchEnd}
          >
            <div className="mx-auto max-h-[68vh] w-full max-w-4xl overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Word details</p>
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

              <MorphologySidebarPanel
                token={selectedToken}
                verseNumber={verse}
                wordIndex={selectedWordIndex ?? 0}
              />

              <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-400/[0.07] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">
                    AI Greek Coach
                  </p>
                  <button
                    type="button"
                    onClick={runAiCoach}
                    disabled={coachLoading}
                    className="rounded-full border border-emerald-300/40 bg-emerald-400/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-100 hover:bg-emerald-400/30 disabled:opacity-60"
                  >
                    {coachLoading ? "Thinking..." : "Coach me"}
                  </button>
                </div>

                {coachError ? <p className="mt-2 text-xs text-red-300/90">{coachError}</p> : null}
                {coachPayload ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm leading-relaxed text-white/90">{coachPayload.insight}</p>
                    <p className="text-xs leading-relaxed text-emerald-100/90">{coachPayload.prayerPrompt}</p>
                  </div>
                ) : !coachLoading && !coachError ? (
                  <p className="mt-2 text-xs text-white/60">
                    One concise Greek insight plus a prayer prompt from this exact form.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <footer className="shrink-0 border-t border-white/10 bg-black/30 backdrop-blur-xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
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
          Word study &amp; grammar in reader
          <ExternalLink className="size-3.5 opacity-80" />
        </Link>
      </footer>
    </div>
  )
}
