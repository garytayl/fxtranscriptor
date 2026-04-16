"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { ArrowLeft, BookOpen, ChevronRight, Languages, Sparkles } from "lucide-react"
import { ROMANS_JOURNEY_STEPS, ROMANS_JOURNEY_TOTAL, type RomansJourneyStep } from "@/lib/romans-journey-data"
import {
  getRomansJourneyProgress,
  setRomansJourneyMode,
  setRomansJourneyStep,
  canAdvanceRomansStep,
  recordRomansJourneyAdvance,
  hasRomansJourneyXpGranted,
  markRomansJourneyXpGranted,
  resetRomansJourney,
  type RomansJourneyMode,
} from "@/lib/romans-journey-progress"
import { recordGreekStudyEvent } from "@/lib/devotions-greek-progress"
import { toast } from "sonner"

type Screen = "landing" | "step" | "done"

type PassagePayload = {
  reference: string
  verses: { number: number; text: string }[]
}

const JOURNEY_XP = 10

export function RomansJourneyClient() {
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [screen, setScreen] = useState<Screen>("landing")
  const [mode, setMode] = useState<RomansJourneyMode>("free")
  const [stepIndex, setStepIndex] = useState(0)
  const [passageOpen, setPassageOpen] = useState(false)
  const [passage, setPassage] = useState<PassagePayload | null>(null)
  const [passageLoading, setPassageLoading] = useState(false)
  const [passageError, setPassageError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const p = getRomansJourneyProgress()
    setMode(p.mode)
    if (p.currentStepIndex >= ROMANS_JOURNEY_TOTAL) {
      setScreen("done")
      setStepIndex(ROMANS_JOURNEY_TOTAL - 1)
    } else {
      setStepIndex(p.currentStepIndex)
    }
  }, [])

  useEffect(() => {
    setPassageOpen(false)
    setPassage(null)
    setPassageError(null)
    setPassageLoading(false)
  }, [stepIndex])

  const step = useMemo((): RomansJourneyStep | null => {
    if (stepIndex < 0 || stepIndex >= ROMANS_JOURNEY_TOTAL) return null
    return ROMANS_JOURNEY_STEPS[stepIndex] ?? null
  }, [stepIndex])

  const togglePassage = useCallback(async () => {
    if (!step) return
    if (passageOpen) {
      setPassageOpen(false)
      return
    }
    if (passage && passage.verses.length > 0) {
      setPassageOpen(true)
      return
    }
    setPassageLoading(true)
    setPassageError(null)
    try {
      const res = await fetch(`/api/bible/passage?ref=${encodeURIComponent(step.passageRef)}`)
      const data = (await res.json()) as { error?: string; reference?: string; verses?: { number: number; text: string }[] }
      if (data.error) throw new Error(data.error)
      const verses = data.verses ?? []
      if (verses.length === 0) throw new Error("No verses returned for this range.")
      setPassage({
        reference: data.reference ?? step.passageRef,
        verses,
      })
      setPassageOpen(true)
    } catch (e) {
      setPassageError(e instanceof Error ? e.message : "Could not load passage.")
      toast.error("Could not load passage")
    } finally {
      setPassageLoading(false)
    }
  }, [step, passage, passageOpen])

  const startJourney = useCallback(() => {
    const p = getRomansJourneyProgress()
    if (p.currentStepIndex >= ROMANS_JOURNEY_TOTAL) {
      setScreen("done")
      return
    }
    setStepIndex(p.currentStepIndex)
    setScreen("step")
  }, [])

  const persistMode = useCallback((m: RomansJourneyMode) => {
    setMode(m)
    setRomansJourneyMode(m)
  }, [])

  const awardStepXp = useCallback((idx: number) => {
    if (hasRomansJourneyXpGranted(idx)) return
    const { awardedXp } = recordGreekStudyEvent({
      kind: "session",
      key: `romans-journey-step-${idx}`,
      xp: JOURNEY_XP,
    })
    markRomansJourneyXpGranted(idx)
    if (awardedXp > 0) toast.success(`+${awardedXp} XP`)
  }, [])

  const goContinue = useCallback(() => {
    if (!canAdvanceRomansStep(mode)) {
      toast.message("Daily journey: one Continue per day. Come back tomorrow—or switch to free roam on the first screen.")
      return
    }
    awardStepXp(stepIndex)
    if (stepIndex >= ROMANS_JOURNEY_TOTAL - 1) {
      recordRomansJourneyAdvance(stepIndex, mode)
      setScreen("done")
      return
    }
    recordRomansJourneyAdvance(stepIndex, mode)
    const next = stepIndex + 1
    setStepIndex(next)
  }, [stepIndex, mode, awardStepXp])

  const goBackStep = useCallback(() => {
    if (stepIndex <= 0) return
    const next = stepIndex - 1
    setStepIndex(next)
    setRomansJourneyStep(next)
  }, [stepIndex])

  const restart = useCallback(() => {
    resetRomansJourney()
    setStepIndex(0)
    setRomansJourneyStep(0)
    setScreen("landing")
    toast.message("Journey reset on this device")
  }, [])

  if (!mounted) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#050505] text-white/50 font-mono text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#050505] text-white overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-950/20 via-transparent to-amber-950/10" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/[0.06]">
        <Link
          href="/devotions/meditation"
          className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-white/45 hover:text-white/75 min-h-[44px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Meditation
        </Link>
        <span className="font-mono text-[10px] tracking-[0.25em] text-white/35 uppercase">Romans</span>
        <span className="w-[72px]" aria-hidden />
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          {screen === "landing" && (
            <motion.div
              key="land"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduced ? 0.15 : 0.35 }}
              className="px-6 sm:px-10 py-12 max-w-lg mx-auto flex flex-col min-h-[70vh] justify-center"
            >
              <div className="mb-10 text-center space-y-3">
                <p className="font-mono text-[10px] tracking-[0.35em] text-violet-300/60 uppercase">Guided path</p>
                <h1 className="font-serif text-3xl sm:text-4xl font-light text-white/[0.95] tracking-tight">Romans Journey</h1>
                <p className="font-sans text-sm text-white/50 font-light leading-relaxed">
                  Walk through the letter one step at a time—reflection first, scripture when you’re ready, Greek tools alongside.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4 mb-10">
                <p className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">Pace</p>
                <div className="flex flex-col gap-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="rj-mode"
                      checked={mode === "free"}
                      onChange={() => persistMode("free")}
                      className="mt-1 accent-violet-500"
                    />
                    <span>
                      <span className="font-sans text-white/90 block">Free roam</span>
                      <span className="font-sans text-xs text-white/45">Move forward anytime.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="rj-mode"
                      checked={mode === "daily"}
                      onChange={() => persistMode("daily")}
                      className="mt-1 accent-violet-500"
                    />
                    <span>
                      <span className="font-sans text-white/90 block">One new step per day</span>
                      <span className="font-sans text-xs text-white/45">Builds rhythm; you can always review earlier steps.</span>
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={startJourney}
                className="w-full min-h-[56px] rounded-2xl bg-violet-500/20 border border-violet-400/40 text-violet-100 font-mono text-[11px] tracking-[0.2em] uppercase hover:bg-violet-500/30 transition-colors"
              >
                {(() => {
                  const p = getRomansJourneyProgress()
                  return p.currentStepIndex > 0 && p.currentStepIndex < ROMANS_JOURNEY_TOTAL ? "Resume journey" : "Start journey"
                })()}
              </button>
              <button
                type="button"
                onClick={restart}
                className="mt-4 font-mono text-[10px] tracking-wider text-white/35 hover:text-white/55 uppercase"
              >
                Reset progress
              </button>
            </motion.div>
          )}

          {screen === "step" && step && (
            <motion.div
              key={`step-${stepIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.12 : 0.28 }}
              className="px-5 sm:px-8 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] max-w-lg mx-auto w-full"
            >
              <div className="mb-8">
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-violet-500/70 rounded-full transition-[width] duration-500"
                    style={{ width: `${((stepIndex + 1) / ROMANS_JOURNEY_TOTAL) * 100}%` }}
                  />
                </div>
                <p className="font-mono text-[10px] text-white/40 text-center tracking-wider">
                  Step {stepIndex + 1} of {ROMANS_JOURNEY_TOTAL}
                </p>
              </div>

              <h2 className="font-serif text-xl sm:text-2xl font-light text-white/[0.95] leading-snug mb-6">{step.label}</h2>

              <p className="font-sans text-sm text-white/65 font-light leading-relaxed mb-8">{step.summary}</p>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 px-5 py-5 mb-8">
                <p className="font-mono text-[9px] tracking-[0.2em] text-amber-200/50 uppercase mb-3">Reflect</p>
                <p className="font-serif text-lg sm:text-xl text-amber-50/95 font-light leading-relaxed">{step.reflectionPrompt}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                  type="button"
                  onClick={togglePassage}
                  disabled={passageLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl border border-white/15 bg-white/[0.04] font-mono text-[10px] tracking-[0.15em] uppercase text-white/85 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                >
                  <BookOpen className="w-4 h-4 text-white/50" aria-hidden />
                  {passageLoading ? "Loading…" : passageOpen ? "Hide passage" : "Read passage"}
                </button>
                <Link
                  href="/devotions/greek"
                  className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl border border-emerald-500/25 bg-emerald-950/30 font-mono text-[10px] tracking-[0.15em] uppercase text-emerald-100/90 hover:bg-emerald-950/50 transition-colors"
                >
                  <Languages className="w-4 h-4 text-emerald-400/70" aria-hidden />
                  Greek study
                </Link>
              </div>

              <AnimatePresence>
                {passageOpen && passage && passage.verses.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: reduced ? 0.12 : 0.22 }}
                    className="mb-8"
                  >
                    <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-5 sm:px-6 max-h-[min(56vh,520px)] overflow-y-auto overscroll-contain">
                      <p className="text-center font-mono text-[10px] tracking-[0.35em] text-amber-200/55 mb-6 uppercase">
                        {passage.reference}
                      </p>
                      <div className="max-w-2xl mx-auto space-y-5">
                        {passage.verses.map((v) => (
                          <p
                            key={v.number}
                            className="font-serif text-[1.05rem] sm:text-[1.2rem] leading-[1.65] text-white/[0.92] font-light"
                          >
                            <sup className="font-mono text-[0.55em] text-amber-200/45 mr-1.5 tabular-nums">{v.number}</sup>
                            {v.text}
                          </p>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {passageError && (
                <p className="font-sans text-sm text-red-400/90 text-center mb-6">{passageError}</p>
              )}

              <p className="font-sans text-[11px] text-white/35 text-center mb-8">
                Passage loads here so you stay in the journey. Greek Study uses pilot verses for morphology drills.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={goContinue}
                  className="w-full min-h-[54px] rounded-2xl flex items-center justify-center gap-2 bg-white/[0.08] border border-white/20 text-white font-mono text-[11px] tracking-[0.2em] uppercase hover:bg-white/[0.12] transition-colors"
                >
                  {stepIndex >= ROMANS_JOURNEY_TOTAL - 1 ? "Finish journey" : "Continue"}
                  <ChevronRight className="w-4 h-4 opacity-60" aria-hidden />
                </button>
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={goBackStep}
                    className="font-mono text-[10px] tracking-wider text-white/40 hover:text-white/60 uppercase py-2"
                  >
                    Previous step
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {screen === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 py-16 max-w-md mx-auto text-center space-y-8"
            >
              <Sparkles className="w-10 h-10 text-violet-400/80 mx-auto" aria-hidden />
              <div>
                <h2 className="font-serif text-2xl font-light text-white/95 mb-2">You walked the letter</h2>
                <p className="font-sans text-sm text-white/50 font-light">
                  Twenty-five steps through one argument—God’s righteousness in the gospel. Come back anytime.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={restart}
                  className="min-h-[48px] rounded-xl border border-white/15 bg-white/[0.06] font-mono text-[11px] tracking-[0.2em] uppercase text-white/90"
                >
                  Start again
                </button>
                <Link
                  href="/devotions/meditation"
                  className="min-h-[48px] rounded-xl flex items-center justify-center font-mono text-[11px] tracking-[0.2em] uppercase text-white/45 hover:text-white/70"
                >
                  All meditations
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
