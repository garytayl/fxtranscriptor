"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"

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
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [english, setEnglish] = useState("")
  const [greekLine, setGreekLine] = useState("")

  const pilot: MorphPilotChapterMenuItem = MORPH_PILOT_CHAPTERS[pilotIdx] ?? MORPH_PILOT_CHAPTERS[0]

  const passageRef = useMemo(() => morphPilotPassageRef(pilot, verse), [pilot, verse])

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
    if (!hydrated) return

    const controller = new AbortController()
    const ref = passageRef
    const t = FX_GREEK_GRAMMAR_TRANSLATION_KEY

    setLoading(true)
    setError(null)

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

        if (!passRes.ok) {
          const msg = typeof pass.error === "string" ? pass.error : "Could not load this verse."
          setError(msg)
          setEnglish("")
          setGreekLine("")
          return
        }
        if (typeof pass.error === "string" && pass.error) {
          setError(pass.error)
          setEnglish("")
          setGreekLine("")
          return
        }

        const verses = pass.verses as PassageVerse[] | undefined
        const row = verses?.find((v) => v.number === verse) ?? verses?.[0]
        setEnglish(row?.text ? stripHtmlTags(row.text).replace(/\s+/g, " ").trim() : "")

        const mVerses = morph.verses as { number: number; tokens: { word: string }[] }[] | undefined
        const mv = mVerses?.find((x) => x.number === verse) ?? mVerses?.[0]
        const line = mv?.tokens?.length ? mv.tokens.map((tok) => tok.word).join(" ") : ""
        setGreekLine(line)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError("Could not load this verse.")
        setEnglish("")
        setGreekLine("")
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
  }, [])

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
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        prevVerse()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        nextVerse()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [prevVerse, nextVerse])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden bg-gradient-to-b from-[#06080f] via-[#050505] to-[#030306] text-white">
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 border-b border-white/[0.06]">
        <Link
          href="/devotions"
          className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/45 hover:text-white/75 min-h-[44px] min-w-[44px] px-1"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div className="flex rounded-full border border-white/10 bg-black/25 p-0.5 shrink-0">
          {MORPH_PILOT_CHAPTERS.map((c, idx) => {
            const active = idx === pilotIdx
            return (
              <button
                key={`${c.bookSlug}-${c.chapter}`}
                type="button"
                onClick={() => selectPilot(idx)}
                className={`rounded-full px-3 py-1.5 min-h-[40px] text-[11px] font-mono tracking-wide transition-colors ${
                  active ? "bg-amber-500/20 text-amber-100" : "text-white/45 hover:text-white/70"
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        <span className="font-mono text-[10px] text-white/35 tabular-nums text-right min-w-[3.5rem]">
          {verse}/{pilot.maxVerse}
        </span>
      </header>

      <div
        className="flex-1 min-h-0 flex flex-col items-stretch justify-center px-5 sm:px-10 md:px-16"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="region"
        aria-label="Verse text. Swipe or use arrow keys to change verse."
      >
        <div className="w-full max-w-4xl mx-auto flex flex-col justify-center min-h-0 py-4 gap-8 sm:gap-10">
          <p className="font-mono text-[11px] sm:text-xs tracking-[0.2em] text-amber-500/70 text-center uppercase shrink-0">
            {passageRef.replace(":", " · ")}
          </p>

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
                <p
                  className="font-sans font-light text-white/[0.96] text-center leading-[1.25] tracking-tight px-1"
                  style={{ fontSize: "clamp(1.65rem, 5.8vw, 3.25rem)" }}
                >
                  {english || (error ? "" : "—")}
                </p>

                {greekLine ? (
                  <p
                    lang="el"
                    className="font-serif text-center leading-[1.35] text-amber-200/88 px-1"
                    style={{ fontSize: "clamp(1.35rem, 4.6vw, 2.65rem)" }}
                  >
                    {greekLine}
                  </p>
                ) : !loading && !error && english ? (
                  <p className="text-center text-sm text-white/40 font-sans">Greek text unavailable for this verse.</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-white/[0.06] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-black/20">
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
