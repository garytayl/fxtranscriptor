"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import {
  getMeditationSeries,
  passageRefForSeries,
  isDailySeriesId,
  passageCountForSeries,
} from "@/lib/meditation-series"
import { getMeditationPassageIndex, advanceMeditationPassageIndex } from "@/lib/meditation-series-progress"
import { savePassageEntry } from "@/lib/devotions-storage"
import { recordDevotionSession } from "@/lib/devotions-tracking"
import { getDevotionsSettings } from "@/lib/devotions-settings"
import { toast } from "sonner"

type PassageData = {
  reference: string
  verses: { number: number; text: string }[]
}

type Phase = "read" | "compose" | "reflect"

export function MeditationSessionClient({ seriesId }: { seriesId: string }) {
  const reduced = useReducedMotion()
  const series = getMeditationSeries(seriesId)
  const [phase, setPhase] = useState<Phase>("read")
  const [passage, setPassage] = useState<PassageData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingPassage, setLoadingPassage] = useState(true)
  const [reflection, setReflection] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [opening, setOpening] = useState("")
  const [prompts, setPrompts] = useState<string[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  /** 1-based position in series for header (non-daily). */
  const [ordinalLabel, setOrdinalLabel] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composeBootRef = useRef(false)
  const loadTokenRef = useRef(0)

  const loadPassageForSeries = useCallback(() => {
    if (!series) return
    const token = ++loadTokenRef.current
    const idx = getMeditationPassageIndex(seriesId)
    const ref = passageRefForSeries(seriesId, idx)
    const total = passageCountForSeries(seriesId)
    if (!isDailySeriesId(seriesId) && total > 0) {
      setOrdinalLabel(`${idx + 1} / ${total}`)
    } else {
      setOrdinalLabel(null)
    }
    setLoadingPassage(true)
    setLoadError(null)
    setReflection("")
    setOpening("")
    setPrompts([])
    setAiError(null)
    setPhase("read")
    composeBootRef.current = false
    fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}`)
      .then((res) => res.json())
      .then((data) => {
        if (token !== loadTokenRef.current) return
        if (data.error) throw new Error(data.error)
        const p = { reference: data.reference as string, verses: (data.verses ?? []) as PassageData["verses"] }
        setPassage(p)
        const settings = getDevotionsSettings()
        recordDevotionSession(p.reference, settings.showTracking)
      })
      .catch((err) => {
        if (token !== loadTokenRef.current) return
        setLoadError(err instanceof Error ? err.message : "Could not load passage.")
      })
      .finally(() => {
        if (token === loadTokenRef.current) setLoadingPassage(false)
      })
  }, [series, seriesId])

  useEffect(() => {
    loadPassageForSeries()
  }, [loadPassageForSeries])

  const passagePlain = passage
    ? passage.verses.map((v) => `${v.number} ${v.text}`).join("\n")
    : ""

  const beginWriting = useCallback(() => {
    setPhase("compose")
  }, [])

  useEffect(() => {
    if (phase !== "compose" || composeBootRef.current) return
    const t = window.setTimeout(() => {
      textareaRef.current?.focus()
      composeBootRef.current = true
    }, reduced ? 0 : 320)
    return () => window.clearTimeout(t)
  }, [phase, reduced])

  const requestReflection = useCallback(async () => {
    if (!passage || reflection.trim().length < 4) {
      toast.message("Write a few words first.")
      return
    }
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch("/api/devotions/meditation-reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: passage.reference,
          passageText: passagePlain,
          userReflection: reflection.trim(),
        }),
      })
      const data = (await res.json()) as { error?: string; opening?: string; prompts?: string[] }
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Could not reach the reflection helper.")
      }
      setOpening(data.opening ?? "")
      setPrompts(Array.isArray(data.prompts) ? data.prompts : [])
      setPhase("reflect")
      savePassageEntry(passage.reference, {
        prayer: "",
        reflection:
          `${reflection.trim()}\n\n—\nPrompts:\n` + (data.prompts ?? []).map((p, i) => `${i + 1}. ${p}`).join("\n"),
      })
      const count = passageCountForSeries(seriesId)
      if (count > 0) {
        advanceMeditationPassageIndex(seriesId, count)
      }
      toast.success("Saved to your journal on this device")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong."
      setAiError(msg)
      toast.error(msg)
    } finally {
      setAiLoading(false)
    }
  }, [passage, passagePlain, reflection, seriesId])

  const goToNextInSeries = useCallback(() => {
    loadPassageForSeries()
  }, [loadPassageForSeries])

  const seriesTitle = series?.title ?? "Meditation"

  if (!series) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#030303] text-white px-6">
        <p className="font-sans text-white/70 mb-4">This meditation track is not available.</p>
        <Link href="/devotions/meditation" className="font-mono text-xs text-amber-400/90 underline-offset-4 hover:underline">
          Back to series
        </Link>
      </div>
    )
  }
  const showNextInSeries = !isDailySeriesId(seriesId) && passageCountForSeries(seriesId) > 0

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#030303] text-white overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-950/[0.12] via-transparent to-violet-950/[0.08]" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 min-h-[52px] sm:px-8">
        <Link
          href="/devotions/meditation"
          className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-white/45 hover:text-white/75 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Series
        </Link>
        {passage && (
          <span className="font-mono text-[10px] tracking-[0.25em] text-white/35 truncate max-w-[45vw] text-right">
            {phase === "read" ? "Read" : phase === "compose" ? "Write" : "Reflect"}
          </span>
        )}
        <Link
          href="/devotions"
          className="w-[72px] text-right font-mono text-[9px] tracking-wider text-white/30 hover:text-white/55"
        >
          Exit
        </Link>
      </header>

      <p className="relative z-10 text-center font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase px-4 -mt-1 pb-2">
        {seriesTitle}
        {ordinalLabel && <span className="text-white/45"> · {ordinalLabel}</span>}
      </p>

      <main className="relative z-10 flex-1 min-h-0 flex flex-col">
        {loadingPassage && (
          <div className="flex-1 flex items-center justify-center font-mono text-sm text-white/40">Loading…</div>
        )}

        {loadError && !loadingPassage && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="font-sans text-white/70">{loadError}</p>
            <Link href="/devotions/meditation" className="font-mono text-xs tracking-wider text-amber-400/90 underline-offset-4 hover:underline">
              Back to series
            </Link>
          </div>
        )}

        {passage && !loadError && (
          <AnimatePresence mode="wait">
            {phase === "read" && (
              <motion.div
                key="read"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.35 }}
                className="flex-1 min-h-0 flex flex-col px-6 sm:px-12 md:px-16 pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                <p className="text-center font-mono text-[10px] tracking-[0.35em] text-amber-200/50 mb-8 mt-2 uppercase">
                  {passage.reference}
                </p>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
                  <div className="max-w-2xl mx-auto space-y-5 pb-24">
                    {passage.verses.map((v) => (
                      <p key={v.number} className="font-serif text-[1.15rem] sm:text-[1.35rem] md:text-[1.5rem] leading-[1.65] text-white/[0.92] font-light">
                        <sup className="font-mono text-[0.55em] text-amber-200/45 mr-1.5 tabular-nums">{v.number}</sup>
                        {v.text}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 pt-4 pb-2 flex flex-col items-center gap-6">
                  <p className="font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase">When you&apos;re ready</p>
                  <button
                    type="button"
                    onClick={beginWriting}
                    className="group flex flex-col items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded-lg px-4 py-2"
                  >
                    <span className="font-mono text-xs text-white/50 group-hover:text-white/70 transition-colors">
                      Continue to reflection
                    </span>
                    <span className="flex items-center gap-0.5 h-8" aria-hidden>
                      <motion.span
                        className="inline-block w-[3px] h-7 bg-amber-400/90 rounded-[1px]"
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </span>
                  </button>
                </div>
              </motion.div>
            )}

            {phase === "compose" && (
              <motion.div
                key="compose"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.4 }}
                className="flex-1 min-h-0 flex flex-col px-4 sm:px-10 md:px-16 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                <p className="text-center font-mono text-[10px] tracking-[0.3em] text-white/35 mb-6 uppercase truncate px-2">
                  {passage.reference}
                </p>
                <div
                  role="presentation"
                  onClick={() => textareaRef.current?.focus()}
                  className="relative flex-1 min-h-[45vh] w-full max-w-3xl mx-auto text-left rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 sm:px-8 sm:py-8 cursor-text focus-within:ring-1 focus-within:ring-amber-400/30 transition-colors hover:bg-white/[0.03]"
                >
                  {reflection.length === 0 && (
                    <div
                      className="pointer-events-none absolute left-5 top-6 sm:left-8 sm:top-8 right-5 flex items-start gap-2 font-serif text-lg sm:text-xl md:text-[1.35rem] text-white/28 leading-relaxed"
                      aria-hidden
                    >
                      <motion.span
                        className="inline-block w-[3px] min-h-[1.15em] bg-amber-400/90 rounded-[1px] shrink-0 mt-1"
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <span>What surfaced as you sat with this passage?</span>
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    spellCheck
                    autoComplete="off"
                    aria-label="Your reflection"
                    className={`relative z-10 w-full min-h-[38vh] bg-transparent border-0 p-0 m-0 font-serif text-lg sm:text-xl md:text-[1.35rem] leading-relaxed text-white/[0.88] placeholder:text-transparent focus:ring-0 focus:outline-none resize-none selection:bg-amber-500/25 ${
                      reflection.length === 0 ? "caret-transparent" : "caret-amber-300/90"
                    }`}
                  />
                </div>

                <div className="shrink-0 flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("read")
                      composeBootRef.current = false
                    }}
                    className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/35 hover:text-white/55 py-2 px-3"
                  >
                    Back to passage
                  </button>
                  <button
                    type="button"
                    disabled={aiLoading || reflection.trim().length < 4}
                    onClick={requestReflection}
                    className="min-h-[48px] rounded-full px-8 font-mono text-[11px] tracking-[0.2em] uppercase bg-white/[0.08] border border-white/15 text-white/90 hover:bg-white/12 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                  >
                    {aiLoading ? "…" : "Ask for prompts"}
                  </button>
                </div>
                {aiError && (
                  <p className="text-center text-sm text-red-400/90 mt-4 max-w-md mx-auto">{aiError}</p>
                )}
              </motion.div>
            )}

            {phase === "reflect" && (
              <motion.div
                key="reflect"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.45 }}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 sm:px-12 md:px-16 pb-[max(2rem,env(safe-area-inset-bottom))]"
              >
                <div className="max-w-xl mx-auto space-y-10 pt-4">
                  <p className="font-serif text-xl sm:text-2xl text-white/[0.9] font-light leading-snug">{opening}</p>
                  <ul className="space-y-6">
                    {prompts.map((p, i) => (
                      <li
                        key={i}
                        className="pl-5 border-l border-amber-400/25 font-sans text-base sm:text-lg text-white/80 font-light leading-relaxed"
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                  <div className="pt-6 flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
                    <Link
                      href="/devotions/meditation"
                      className="inline-flex justify-center min-h-[48px] items-center rounded-full px-8 font-mono text-[11px] tracking-[0.2em] uppercase bg-white/[0.08] border border-white/15 text-white/90 hover:bg-white/12 transition-colors"
                    >
                      All series
                    </Link>
                    {showNextInSeries && (
                      <button
                        type="button"
                        onClick={goToNextInSeries}
                        className="inline-flex justify-center min-h-[48px] items-center rounded-full px-8 font-mono text-[11px] tracking-[0.2em] uppercase bg-violet-500/15 border border-violet-400/35 text-violet-100/95 hover:bg-violet-500/25 transition-colors"
                      >
                        Next in series
                      </button>
                    )}
                    <Link
                      href="/devotions"
                      className="inline-flex justify-center min-h-[48px] items-center rounded-full px-8 font-mono text-[11px] tracking-[0.2em] uppercase text-white/50 border border-white/10 hover:bg-white/[0.05] transition-colors"
                    >
                      Done
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  )
}
