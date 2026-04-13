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

type StoredPlace = {
  bookSlug: string
  chapter: number
  verse: number
}

type PassageVerse = { number: number; text: string }
type GreekCoachPayload = {
  insight: string
  prayerPrompt: string
}

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
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null)
  const [showPrimer, setShowPrimer] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [coachPayload, setCoachPayload] = useState<GreekCoachPayload | null>(null)
  const [coachTokenKey, setCoachTokenKey] = useState<string | null>(null)
  const menuSwipeStartY = useRef<number | null>(null)
  const menuSwipeCurrentY = useRef<number | null>(null)

  const pilot: MorphPilotChapterMenuItem = MORPH_PILOT_CHAPTERS[pilotIdx] ?? MORPH_PILOT_CHAPTERS[0]

  const passageRef = useMemo(() => morphPilotPassageRef(pilot, verse), [pilot, verse])
  const verseProgress = `${Math.max(3, (verse / pilot.maxVerse) * 100)}%`

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

  const readerUrl = useMemo(
    () => morphPilotReaderUrl(pilot.bookSlug, pilot.chapter, verse),
    [pilot.bookSlug, pilot.chapter, verse],
  )

  const prevVerse = useCallback(() => {
    setVerse((v) => Math.max(1, v - 1))
  }, [])

  const nextVerse = useCallback(() => {
    setVerse((v) => Math.min(pilot.maxVerse, v + 1))
  }, [pilot.maxVerse])

  const selectPilot = useCallback((idx: number) => {
    setPilotIdx(idx)
    setVerse(1)
    setMenuOpen(false)
  }, [])

  const jumpToVerse = useCallback(() => {
    const num = Number.parseInt(verseDraft.trim(), 10)
    if (!Number.isFinite(num)) return
    setVerse(Math.min(pilot.maxVerse, Math.max(1, num)))
    setMenuOpen(false)
  }, [pilot.maxVerse, verseDraft])

  const handleSelectGreekWord = useCallback((_: number, wordIndex: number) => {
    setSelectedWordIndex((prev) => (prev === wordIndex ? null : wordIndex))
  }, [])

  const selectedToken =
    selectedWordIndex != null && selectedWordIndex >= 0 ? greekTokens[selectedWordIndex] ?? null : null
  const selectedTokenExpanded = selectedToken ? expandGreekMorphToken(selectedToken) : null

  const runAiCoach = useCallback(async () => {
    if (!selectedToken) return
    const tokenKey = `${pilot.bookSlug}-${pilot.chapter}-${verse}-${selectedWordIndex}-${selectedToken.word}`
    if (coachLoading) return
    if (coachTokenKey === tokenKey && coachPayload) return
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
        [data?.microGloss, data?.grammarHook].filter((s): s is string => typeof s === "string" && s.length > 0).join(
          " ",
        )
      const prayerPrompt = data?.prayerPrompt ?? data?.reflectionPrompt
      if (!response.ok || !insight || !prayerPrompt) {
        throw new Error(data?.error || "Could not generate AI coach insight.")
      }
      setCoachPayload({
        insight: insight.trim(),
        prayerPrompt: prayerPrompt.trim(),
      })
      setCoachTokenKey(tokenKey)
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Could not generate AI coach insight.")
    } finally {
      setCoachLoading(false)
    }
  }, [
    selectedToken,
    selectedTokenExpanded,
    coachLoading,
    coachTokenKey,
    coachPayload,
    passageRef,
    english,
    pilot.bookSlug,
    pilot.chapter,
    verse,
    selectedWordIndex,
  ])

  const swipeStartX = useRef<number | null>(null)

  const onTouchStart = useCallback((e: TouchEvent) => {
    swipeStartX.current = e.changedTouches[0]?.clientX ?? null
  }, [])

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = swipeStartX.current
      swipeStartX.current = null
      if (start == null) return
      const end = e.changedTouches[0]?.clientX
      if (end == null) return
      const dx = end - start
      if (dx > 56) prevVerse()
      else if (dx < -56) nextVerse()
    },
    [nextVerse, prevVerse],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false)
      } else if (e.key === "ArrowLeft" && !menuOpen) {
        e.preventDefault()
        prevVerse()
      } else if (e.key === "ArrowRight" && !menuOpen) {
        e.preventDefault()
        nextVerse()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen, prevVerse, nextVerse])

  const hasStudyDrawer = showPrimer || selectedToken != null
  const activeTokenKey =
    selectedToken && selectedWordIndex != null
      ? `${pilot.bookSlug}-${pilot.chapter}-${verse}-${selectedWordIndex}-${selectedToken.word}`
      : null

  useEffect(() => {
    if (!selectedToken || !activeTokenKey) return
    if (coachTokenKey === activeTokenKey) return
    setCoachPayload(null)
    setCoachError(null)
  }, [selectedToken, activeTokenKey, coachTokenKey])
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

  const onMenuTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const startY = menuSwipeStartY.current
    const endY = menuSwipeCurrentY.current ?? e.changedTouches[0]?.clientY ?? null
    menuSwipeStartY.current = null
    menuSwipeCurrentY.current = null
    if (startY == null) return
    if (endY == null) return
    const deltaY = endY - startY
    if (deltaY > 68) setMenuOpen(false)
  }, [])

  return (
    <div className="fixed inset-0 z-[60] relative flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top,#131822,transparent_40%),linear-gradient(to_bottom,#06080f,#050505,#030306)] text-white">
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 border-b border-white/[0.06] bg-black/25 backdrop-blur-xl">
        <Link
          href="/devotions"
          className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/45 hover:text-white/75 min-h-[44px] min-w-[44px] px-1"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div className="text-center min-w-0">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-emerald-300/70">Greek Studio</p>
          <p className="text-xs text-white/75 truncate">{pilot.label}</p>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75 hover:bg-white/10"
          aria-label="Open Greek study menu"
        >
          <Menu className="size-3.5" />
          Menu
        </button>
      </header>

      {menuOpen ? (
        <div
          className="absolute inset-0 z-[70] bg-black/65 backdrop-blur-sm px-3 pt-[max(4.7rem,calc(env(safe-area-inset-top)+4.2rem))] sm:px-6"
          onPointerDown={() => setMenuOpen(false)}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-3xl rounded-3xl border border-white/15 bg-[#0a0d14]/95 p-4 sm:p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            role="dialog"
            aria-label="Greek study menu"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={onMenuTouchStart}
            onTouchMove={onMenuTouchMove}
            onTouchEnd={onMenuTouchEnd}
            onTouchCancel={() => {
              menuSwipeStartY.current = null
              menuSwipeCurrentY.current = null
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-200/75">
                <Sparkles className="size-3.5" />
                Study Menu
              </p>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                }}
                onClick={() => setMenuOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                aria-label="Close Greek study menu"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Chapter Lab</p>
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
                            ? "border-emerald-300/45 bg-emerald-400/12 text-emerald-100"
                            : "border-white/15 bg-white/[0.03] text-white/75 hover:bg-white/[0.08]"
                        }`}
                      >
                        <p className="font-sans text-sm font-medium">{c.label}</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                          {c.maxVerse} verses
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-3 sm:p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Jump to verse</p>
                <div className="flex gap-2">
                  <input
                    value={verseDraft}
                    onChange={(e) => setVerseDraft(e.target.value)}
                    inputMode="numeric"
                    className="flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/30 focus:border-emerald-300/50 focus:outline-none"
                    placeholder={`1-${pilot.maxVerse}`}
                    aria-label="Verse number"
                  />
                  <button
                    type="button"
                    onClick={jumpToVerse}
                    className="rounded-xl border border-emerald-300/35 bg-emerald-400/15 px-4 font-mono text-xs uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-400/25"
                  >
                    Go
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWordHintsEnabled((v) => !v)}
                  className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    wordHintsEnabled
                      ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                      : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  {wordHintsEnabled ? "Hints: On" : "Hints: Off"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnglish((v) => !v)}
                  className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    showEnglish
                      ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                      : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  {showEnglish ? "English: On" : "English: Off"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrimer((v) => !v)
                    setMenuOpen(false)
                  }}
                  className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    showPrimer
                      ? "border-purple-300/50 bg-purple-300/15 text-purple-100"
                      : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  {showPrimer ? "Primer: On" : "Primer: Off"}
                </button>
                <Link
                  href={readerUrl}
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
                >
                  Full Reader
                  <ExternalLink className="size-3.5 opacity-70" />
                </Link>
              </div>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={() => setMenuOpen(false)}
            onClick={() => setMenuOpen(false)}
            className="mx-auto mt-3 block rounded-full border border-white/20 bg-white/10 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75 hover:bg-white/15"
            aria-label="Close study menu"
          >
            Close
          </button>
        </div>
      ) : null}

      <div
        className="flex-1 min-h-0 flex flex-col items-stretch justify-center px-5 sm:px-10 md:px-16"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="region"
        aria-label="Verse text. Swipe or use arrow keys to change verse."
      >
        <div className="w-full max-w-4xl mx-auto flex flex-col justify-center min-h-0 py-4 gap-8 sm:gap-10">
          <div className="space-y-2">
            <p className="font-mono text-[11px] sm:text-xs tracking-[0.2em] text-emerald-300/70 text-center uppercase shrink-0">
              {passageRef.replace(":", " · ")}
            </p>
            <div className="mx-auto h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-300/80 to-amber-300/80" style={{ width: verseProgress }} />
            </div>
            <p className="text-center font-mono text-[10px] tracking-[0.18em] uppercase text-white/35">
              Verse {verse} of {pilot.maxVerse}
            </p>
          </div>

          {error ? (
            <p className="text-center text-red-300/90 text-sm font-sans">{error}</p>
          ) : null}

          <div className="flex flex-col gap-6 sm:gap-8 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            {loading ? (
              <div className="space-y-4 animate-pulse" aria-busy="true">
                <div className="h-8 sm:h-10 bg-white/10 rounded-lg w-3/4 mx-auto" />
                <div className="h-8 sm:h-10 bg-white/10 rounded-lg w-full" />
                <div className="h-8 sm:h-10 bg-white/10 rounded-lg w-5/6 mx-auto" />
              </div>
            ) : (
              <>
                {greekTokens.length > 0 ? (
                  <div className="min-h-[52vh] sm:min-h-[56vh] flex items-center justify-center">
                    <div
                      lang="el"
                      className="w-full text-center text-amber-100/95 leading-[1.32] sm:leading-[1.28] flex flex-wrap justify-center gap-x-3 gap-y-3.5 sm:gap-y-4 px-1"
                      style={{ fontSize: "clamp(2.15rem, 8.2vw, 5.8rem)" }}
                    >
                      {greekTokens.map((tok, wi) => {
                        const isSel = selectedWordIndex === wi
                        const hint = wordHintsEnabled ? getMorphHintAbbrev(tok) : null
                        return (
                          <span key={`${verse}-${wi}-${tok.word}`} className="inline-flex flex-col items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleSelectGreekWord(verse, wi)}
                              className={`transition-colors ${
                                isSel
                                  ? "text-amber-200 border-b-2 border-amber-300/85"
                                  : "text-amber-100/95 border-b border-dashed border-amber-300/35 hover:border-amber-300/70 hover:text-amber-50"
                              }`}
                            >
                              {tok.word}
                            </button>
                            {hint ? (
                              <span
                                className="font-mono text-[9px] sm:text-[10px] leading-none text-amber-400/70 max-w-[6rem] truncate"
                                title={hint}
                              >
                                {hint}
                              </span>
                            ) : null}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : !loading && !error && english ? (
                  <p className="text-center text-sm text-white/40 font-sans">Greek text unavailable for this verse.</p>
                ) : null}
                {showEnglish && english ? (
                  <p
                    className="font-sans font-light text-white/70 text-center leading-[1.4] tracking-tight px-2"
                    style={{ fontSize: "clamp(1.05rem, 3.2vw, 1.6rem)" }}
                  >
                    {english}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {hasStudyDrawer ? (
        <div className="shrink-0 border-t border-white/[0.08] bg-black/45 backdrop-blur-xl max-h-[38vh] overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-6 sm:py-4 space-y-3">
            {showPrimer ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-purple-200/70 mb-2">
                  Grammar Primer
                </p>
                <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                  Tap a Greek word to inspect tense, voice, mood, and case. Use hints for compact training wheels (for
                  example, <span className="font-mono text-white/80">aor.act.ind</span> or{" "}
                  <span className="font-mono text-white/80">nom.sg.m</span>). Turn primer off in Menu for pure reading mode.
                </p>
              </div>
            ) : null}
            {selectedToken ? (
              <div className="rounded-xl border border-white/10 bg-black/25 p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
                    Word details
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedWordIndex(null)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
                    aria-label="Close word details"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <MorphologySidebarPanel
                  token={selectedToken}
                  verseNumber={verse}
                  wordIndex={selectedWordIndex ?? 0}
                />
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">
                      AI Greek Coach
                    </p>
                    <button
                      type="button"
                      onClick={runAiCoach}
                      disabled={coachLoading}
                      className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-100 hover:bg-emerald-400/25 disabled:opacity-60"
                    >
                      {coachLoading ? "Thinking…" : "Coach me"}
                    </button>
                  </div>
                  {coachError ? (
                    <p className="mt-2 text-xs text-red-300/90">{coachError}</p>
                  ) : null}
                  {coachPayload ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-white/85 leading-relaxed">{coachPayload.insight}</p>
                      <p className="text-xs text-emerald-100/85 leading-relaxed">{coachPayload.prayerPrompt}</p>
                    </div>
                  ) : !coachLoading && !coachError ? (
                    <p className="mt-2 text-xs text-white/55">
                      Get one short insight, then a prayerful reflection prompt from this exact Greek form.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <footer className="shrink-0 border-t border-white/[0.06] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-black/25 backdrop-blur-lg">
        <div className="flex items-stretch gap-3 justify-center max-w-lg mx-auto">
          <button
            type="button"
            onClick={prevVerse}
            disabled={verse <= 1 || loading}
            className="flex-1 min-h-[52px] rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:bg-white/15 disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center gap-1 font-mono text-xs tracking-wider text-white/90"
            aria-label="Previous verse"
          >
            <ChevronLeft className="w-5 h-5" />
            Prev
          </button>
          <button
            type="button"
            onClick={nextVerse}
            disabled={verse >= pilot.maxVerse || loading}
            className="flex-1 min-h-[52px] rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:bg-white/15 disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center gap-1 font-mono text-xs tracking-wider text-white/90"
            aria-label="Next verse"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <Link
          href={readerUrl}
          className="mt-3 flex w-full min-h-[44px] items-center justify-center gap-2 font-mono text-[11px] text-amber-400/80 hover:text-amber-300 transition-colors"
        >
          Word study &amp; grammar in reader
          <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden />
        </Link>
      </footer>
    </div>
  )
}
