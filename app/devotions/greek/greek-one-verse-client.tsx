"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"

import {
  MORPH_PILOT_CHAPTERS,
  morphPilotReaderUrl,
  type MorphPilotChapterMenuItem,
} from "@/lib/bible/morph-pilot-menu"

const STORAGE_KEY = "fx_devotions_greek_place_v1"

type StoredPlace = {
  bookSlug: string
  chapter: number
  verse: number
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

export function GreekOneVerseClient() {
  const [pilotIdx, setPilotIdx] = useState(0)
  const [verse, setVerse] = useState(1)
  const [hydrated, setHydrated] = useState(false)

  const pilot: MorphPilotChapterMenuItem = MORPH_PILOT_CHAPTERS[pilotIdx] ?? MORPH_PILOT_CHAPTERS[0]

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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col h-screen max-h-[100dvh] bg-[#050505] text-white overflow-x-hidden">
      <header className="shrink-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 min-h-[52px] sm:px-6 border-b border-white/5">
        <Link
          href="/devotions"
          className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-white/45 hover:text-white/75 min-h-[44px] pr-2"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          Devotions
        </Link>
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/35 truncate max-w-[50vw] text-center">
          Greek · one verse
        </span>
        <span className="w-[72px]" aria-hidden />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="font-sans text-2xl sm:text-3xl font-light text-white/95 leading-tight">
              Learn Greek one verse at a time
            </h1>
            <p className="font-sans text-sm text-white/55 leading-relaxed">
              Pick a chapter, step through verses, then open the full reader. Tap Greek words for grammar and
              morphology.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {MORPH_PILOT_CHAPTERS.map((c, idx) => {
              const active = idx === pilotIdx
              return (
                <button
                  key={`${c.bookSlug}-${c.chapter}`}
                  type="button"
                  onClick={() => selectPilot(idx)}
                  className={`rounded-2xl border min-h-[88px] px-3 py-3 text-left transition-colors ${
                    active
                      ? "border-amber-400/50 bg-amber-500/10 text-white"
                      : "border-white/12 bg-white/[0.03] text-white/80 hover:border-white/20 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="block font-sans text-base font-medium">{c.label}</span>
                  <span className="block font-sans text-[11px] text-white/45 mt-1 line-clamp-2">{c.tagline}</span>
                </button>
              )
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 space-y-6">
            <div className="text-center space-y-1">
              <p className="font-mono text-[10px] tracking-[0.25em] text-white/40 uppercase">Verse</p>
              <p className="font-sans text-4xl sm:text-5xl font-light tabular-nums text-white/95">{verse}</p>
              <p className="font-mono text-xs text-white/45">
                of {pilot.maxVerse} · {pilot.label}
              </p>
            </div>

            <div className="flex items-stretch gap-3 justify-center">
              <button
                type="button"
                onClick={prevVerse}
                disabled={verse <= 1}
                className="flex-1 max-w-[120px] min-h-[56px] rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:bg-white/15 disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center gap-1 font-mono text-[11px] tracking-wider text-white/85"
                aria-label="Previous verse"
              >
                <ChevronLeft className="w-5 h-5" />
                Prev
              </button>
              <button
                type="button"
                onClick={nextVerse}
                disabled={verse >= pilot.maxVerse}
                className="flex-1 max-w-[120px] min-h-[56px] rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:bg-white/15 disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center gap-1 font-mono text-[11px] tracking-wider text-white/85"
                aria-label="Next verse"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <Link
              href={readerUrl}
              className="flex w-full min-h-[56px] rounded-xl font-sans text-base font-light items-center justify-center gap-2 bg-amber-500/15 border border-amber-400/35 text-amber-100 hover:bg-amber-500/25 transition-colors"
            >
              Open in Scripture reader
              <ExternalLink className="w-4 h-4 opacity-70" aria-hidden />
            </Link>
          </div>

          <p className="font-mono text-[10px] tracking-wider text-white/35 text-center leading-relaxed px-2">
            Uses the Greek grammar pilot (SBL text + morphology). English is KJV-aligned for word study. Your place
            is saved on this device.
          </p>
        </div>
      </div>
    </div>
  )
}
