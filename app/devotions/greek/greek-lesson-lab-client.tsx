"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, BookOpen, Loader2, Sparkles, Table2, Volume2, Zap } from "lucide-react"

import { GreekStudyMenuShell, GreekMenuSection } from "@/app/devotions/greek/greek-study-menu-shell"
import {
  buildLessonDrafts,
  finalizeLessonDrafts,
  lessonSessionKey,
  type LessonCard,
  type LessonCardKind,
} from "@/lib/greek-lesson-session"
import { recordGreekStudyEvent } from "@/lib/devotions-greek-progress"
import { useGreekUiPreferences } from "@/lib/devotions-greek-ui-preferences"
import {
  getGreekWordMemory,
  listGreekWordMemoryRows,
  recordGreekWordMemoryTap,
} from "@/lib/devotions-greek-word-memory"
import { normalizeGreekLemma } from "@/lib/bible/greek-lemma-english-quiz"
import { ENDINGS_TABLES, GRAMMAR_GLOSSARY } from "@/lib/greek-endings-reference"
import {
  playQuestFeedbackSound,
  todayDateKey,
  vibrateQuest,
} from "@/app/devotions/greek/greek-verse-quest-logic"

import { PracticeLayout } from "@/app/devotions/greek/greek-practice-layout"
import { buildStudyCoachProgressDigest } from "@/lib/greek-study-coach-context"
import { cn } from "@/lib/utils"

const LESSON_COACH_QUICK_PROMPTS = [
  {
    label: "Prep for next time",
    question: "How should I prepare so I do not miss this kind of item next time?",
  },
  {
    label: "Smallest thing to memorize",
    question: "What is the smallest fact or pattern I should memorize from this card?",
  },
  {
    label: "Quick drill",
    question: "Give me one 30-second drill I can do before I tap Continue.",
  },
] as const

function LessonSegmentBar({ total, current, accent }: { total: number; current: number; accent: string }) {
  return (
    <div className="mx-auto flex max-w-md gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${i < current ? accent : "bg-white/12"}`}
        />
      ))}
    </div>
  )
}

function EndingTablesScroll() {
  return (
    <div className="space-y-4">
      {ENDINGS_TABLES.map((table) => (
        <article key={table.id} className="rounded-xl border border-white/10 bg-black/30 p-3 sm:p-4">
          <p className="text-xs font-medium text-violet-200/90">{table.title}</p>
          <p className="mt-0.5 text-[11px] text-white/50">{table.subtitle}</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[16rem] border-collapse text-left text-xs">
              <thead className="bg-white/[0.04]">
                <tr>
                  {table.columns.map((column) => (
                    <th
                      key={column}
                      className="border-b border-white/10 px-2 py-1.5 font-medium text-white/55"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={`${table.id}-r-${rowIndex}`} className="odd:bg-white/[0.02]">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${table.id}-r-${rowIndex}-c-${cellIndex}`}
                        className="border-b border-white/5 px-2 py-1.5 text-white/85"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </div>
  )
}

function GrammarGlossaryScroll() {
  return (
    <div className="space-y-2">
      {GRAMMAR_GLOSSARY.map((item) => (
        <article key={item.term} className="rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-3">
          <p className="text-xs font-medium text-cyan-200/90">{item.term}</p>
          <p className="mt-1 text-sm text-white/82">{item.plainMeaning}</p>
          <p className="mt-1 text-[11px] text-white/55">{item.quickExample}</p>
        </article>
      ))}
    </div>
  )
}

function weakLemmasForLesson(): string[] {
  if (typeof window === "undefined") return []
  const rows = listGreekWordMemoryRows(getGreekWordMemory())
  const out = new Set<string>()
  for (const r of rows) {
    if (r.weakScore >= 3 && r.lemma) out.add(normalizeGreekLemma(r.lemma))
  }
  return [...out].slice(0, 48)
}

function kindSummaryLabel(kind: LessonCardKind): string {
  switch (kind) {
    case "endings":
      return "Endings"
    case "gloss_en_to_lemma":
      return "English → Greek"
    case "gloss_lemma_to_en":
      return "Greek → English"
    case "morph":
      return "Verse grammar"
  }
}

type LessonMenuPanel = "home" | "tables" | "glossary"

export function GreekLessonLabClient() {
  const { prefs: uiPrefs, updatePrefs } = useGreekUiPreferences()
  const { hapticsEnabled, soundEffectsEnabled } = uiPrefs
  const [sessionSeed, setSessionSeed] = useState(() => Math.floor(Math.random() * 2 ** 30))
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPanel, setMenuPanel] = useState<LessonMenuPanel>("home")
  const [cards, setCards] = useState<LessonCard[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [wrongCount, setWrongCount] = useState(0)
  const [firstWrongIndex, setFirstWrongIndex] = useState<number | null>(null)
  const [lessonCoachReply, setLessonCoachReply] = useState<string | null>(null)
  const [lessonCoachLoading, setLessonCoachLoading] = useState(false)
  const [lessonCoachError, setLessonCoachError] = useState<string | null>(null)
  const [lessonCoachFollowUps, setLessonCoachFollowUps] = useState<string[]>([])
  const [sessionXp, setSessionXp] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [resultsByKind, setResultsByKind] = useState<Record<LessonCardKind, { tried: number; correct: number }>>(() => ({
    endings: { tried: 0, correct: 0 },
    gloss_en_to_lemma: { tried: 0, correct: 0 },
    gloss_lemma_to_en: { tried: 0, correct: 0 },
    morph: { tried: 0, correct: 0 },
  }))

  const todayKey = useMemo(() => todayDateKey(), [])
  const weakHints = useMemo(() => weakLemmasForLesson(), [])
  const { runId, drafts } = useMemo(() => buildLessonDrafts(sessionSeed, { weakLemmas: weakHints }), [sessionSeed, weakHints])

  const openSheet = useCallback((panel: LessonMenuPanel) => {
    setMenuPanel(panel)
    setMenuOpen(true)
  }, [])

  useEffect(() => {
    if (!menuOpen) setMenuPanel("home")
  }, [menuOpen])

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    setCards(null)
    finalizeLessonDrafts(drafts, sessionSeed)
      .then((c) => {
        if (!cancelled) {
          setCards(c)
          setIndex(0)
          setSelected(null)
          setRevealed(false)
          setWrongCount(0)
          setFirstWrongIndex(null)
          setLessonCoachReply(null)
          setLessonCoachError(null)
          setLessonCoachFollowUps([])
          setSessionXp(0)
          setCorrectCount(0)
          setResultsByKind({
            endings: { tried: 0, correct: 0 },
            gloss_en_to_lemma: { tried: 0, correct: 0 },
            gloss_lemma_to_en: { tried: 0, correct: 0 },
            morph: { tried: 0, correct: 0 },
          })
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not build this lesson. Try again.")
      })
    return () => {
      cancelled = true
    }
  }, [drafts, sessionSeed])

  const card = cards && index < cards.length ? cards[index] : null
  const done = cards != null && index >= cards.length && cards.length > 0

  const bumpResult = useCallback((kind: LessonCardKind, gotCorrect: boolean) => {
    setResultsByKind((prev) => ({
      ...prev,
      [kind]: {
        tried: prev[kind].tried + 1,
        correct: prev[kind].correct + (gotCorrect ? 1 : 0),
      },
    }))
  }, [])

  const awardCard = useCallback(
    (c: LessonCard, xpMultiplier: number) => {
      if (xpMultiplier <= 0) return
      const xpAward = Math.max(1, Math.floor(c.xp * xpMultiplier))
      const key = lessonSessionKey(todayKey, runId, c.index, c.kind)
      const { awardedXp } = recordGreekStudyEvent({ kind: "session", key, xp: xpAward })
      setSessionXp((x) => x + awardedXp)
      setCorrectCount((n) => n + 1)
    },
    [runId, todayKey],
  )

  const onChoose = useCallback(
    (optionIndex: number) => {
      if (!card || revealed) return
      const correct = optionIndex === card.correctIndex
      if (correct) {
        setSelected(optionIndex)
        setRevealed(true)
        const mult = wrongCount === 0 ? 1 : 0.5
        vibrateQuest("correct", { hapticsEnabled })
        playQuestFeedbackSound("correct", { soundEnabled: soundEffectsEnabled })
        if (card.wordMemoryKey) {
          recordGreekWordMemoryTap(card.wordMemoryKey, true)
        }
        awardCard(card, mult)
        bumpResult(card.kind, true)
      } else {
        vibrateQuest("incorrect", { hapticsEnabled })
        playQuestFeedbackSound("incorrect", { soundEnabled: soundEffectsEnabled })
        if (wrongCount === 0) {
          setWrongCount(1)
          setFirstWrongIndex(optionIndex)
          setSelected(optionIndex)
        } else {
          setSelected(optionIndex)
          setRevealed(true)
          if (card.wordMemoryKey) {
            recordGreekWordMemoryTap(card.wordMemoryKey, false)
          }
          bumpResult(card.kind, false)
        }
      }
    },
    [card, revealed, wrongCount, awardCard, bumpResult, hapticsEnabled, soundEffectsEnabled],
  )

  const onContinue = useCallback(() => {
    if (!cards) return
    setSelected(null)
    setRevealed(false)
    setWrongCount(0)
    setFirstWrongIndex(null)
    setLessonCoachReply(null)
    setLessonCoachError(null)
    setLessonCoachFollowUps([])
    setIndex((i) => i + 1)
  }, [cards])

  const askLessonCoach = useCallback(
    async (question: string) => {
      if (!card || !revealed) return
      setLessonCoachLoading(true)
      setLessonCoachError(null)
      setLessonCoachReply(null)
      setLessonCoachFollowUps([])
      try {
        const wrongLines: string[] = []
        if (firstWrongIndex != null) {
          wrongLines.push(`Learner's first wrong tap: "${card.options[firstWrongIndex]}"`)
        }
        if (selected != null && selected !== card.correctIndex) {
          wrongLines.push(`Still wrong at reveal — last tap: "${card.options[selected]}"`)
        }
        const ctx = [
          `Mixed lesson card · ${card.kind} · ${card.topic}`,
          `Prompt: ${card.prompt}`,
          `Correct option: "${card.options[card.correctIndex]}"`,
          ...wrongLines,
          `App explainer: ${card.explainer}`,
        ].join("\n")
        const digest = buildStudyCoachProgressDigest()
        const message = `${ctx}\n\n---\n${question}`
        const res = await fetch("/api/devotions/greek-study-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, progressDigest: digest, history: [] }),
        })
        const data = (await res.json()) as { reply?: string; followUps?: string[]; error?: string }
        if (!res.ok) throw new Error(data?.error || "Coach unavailable.")
        setLessonCoachReply(typeof data.reply === "string" ? data.reply : "")
        const fu = Array.isArray(data.followUps) ? data.followUps.filter((s): s is string => typeof s === "string") : []
        setLessonCoachFollowUps(fu.slice(0, 3))
      } catch (e) {
        setLessonCoachError(e instanceof Error ? e.message : "Coach unavailable.")
      } finally {
        setLessonCoachLoading(false)
      }
    },
    [card, revealed, firstWrongIndex, selected],
  )

  const startNewLesson = useCallback(() => {
    setSessionSeed(Math.floor(Math.random() * 2 ** 30))
  }, [])

  const showRetryHint = wrongCount === 1 && !revealed

  const menuTitle =
    menuPanel === "home" ? "Lesson" : menuPanel === "tables" ? "Ending tables" : "Grammar terms"

  return (
    <PracticeLayout
      title="Lesson"
      accent="violet"
      onMenu={() => openSheet("home")}
      menuLabel="Reference"
      progressSlot={
        cards && cards.length > 0 ? (
          <div className="mx-auto max-w-lg space-y-1">
            <p className="text-center text-[11px] text-white/45">
              {done ? "Session complete" : `${Math.min(index + 1, cards.length)} / ${cards.length}`}
            </p>
            <LessonSegmentBar
              total={cards.length}
              current={done ? cards.length : index + 1}
              accent="bg-violet-400/85"
            />
          </div>
        ) : null
      }
    >
      <GreekStudyMenuShell
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={menuTitle}
        accent="violet"
      >
        <div className="space-y-4 px-0.5">
          {menuPanel !== "home" ? (
            <button
              type="button"
              onClick={() => setMenuPanel("home")}
              className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs text-white/75 hover:bg-white/[0.1]"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back
            </button>
          ) : null}

          {menuPanel === "home" ? (
            <>
              <GreekMenuSection label="Quick reference">
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setMenuPanel("tables")}
                    className="flex w-full items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-100 hover:bg-amber-500/16"
                  >
                    <Table2 className="size-5 shrink-0 opacity-90" aria-hidden />
                    <span>Verb &amp; noun ending tables</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuPanel("glossary")}
                    className="flex w-full items-center gap-3 rounded-xl border border-cyan-400/28 bg-cyan-500/10 px-4 py-3 text-left text-sm text-cyan-100 hover:bg-cyan-500/16"
                  >
                    <BookOpen className="size-5 shrink-0 opacity-90" aria-hidden />
                    <span>Grammar terms (cases, tense, …)</span>
                  </button>
                </div>
              </GreekMenuSection>
              <GreekMenuSection label="Feedback">
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundEffectsEnabled}
                    onClick={() => updatePrefs({ soundEffectsEnabled: !soundEffectsEnabled })}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      soundEffectsEnabled
                        ? "border-violet-400/35 bg-violet-500/15 text-violet-100"
                        : "border-white/12 bg-white/[0.04] text-white/70",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Volume2 className="size-4 shrink-0 opacity-90" aria-hidden />
                      Sound effects
                    </span>
                    <span className="text-[11px] text-white/45">{soundEffectsEnabled ? "On" : "Off"}</span>
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hapticsEnabled}
                    onClick={() => updatePrefs({ hapticsEnabled: !hapticsEnabled })}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      hapticsEnabled
                        ? "border-violet-400/35 bg-violet-500/15 text-violet-100"
                        : "border-white/12 bg-white/[0.04] text-white/70",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Zap className="size-4 shrink-0 opacity-90" aria-hidden />
                      Haptics
                    </span>
                    <span className="text-[11px] text-white/45">{hapticsEnabled ? "On" : "Off"}</span>
                  </button>
                </div>
              </GreekMenuSection>
              <p className="text-xs leading-relaxed text-white/45">
                Everything stays on this screen—open tables or terms anytime. Results still sync to your word bank for
                Verse Quest. Two tries per card: full XP, then half, then none.
              </p>
            </>
          ) : menuPanel === "tables" ? (
            <EndingTablesScroll />
          ) : (
            <GrammarGlossaryScroll />
          )}
        </div>
      </GreekStudyMenuShell>

      <div className="mx-auto flex min-h-full max-w-lg flex-col px-4 pb-16 pt-6 sm:px-6">
        {loadError ? (
          <p className="text-center text-sm text-red-300/90">{loadError}</p>
        ) : cards == null ? (
          <p className="text-center text-sm text-white/50">Loading lesson…</p>
        ) : done ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
          >
            <Sparkles className="size-12 text-violet-300/80" aria-hidden />
            <div>
              <p className="text-lg font-medium text-white/95">Lesson complete</p>
              <p className="mt-2 text-sm text-white/60">
                {correctCount}/{cards.length} correct · +{sessionXp} XP this run
              </p>
            </div>
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left">
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">By skill</p>
              <ul className="mt-2 space-y-1.5 text-sm text-white/75">
                {(
                  ["endings", "gloss_en_to_lemma", "gloss_lemma_to_en", "morph"] as LessonCardKind[]
                ).map((k) => {
                  const r = resultsByKind[k]
                  if (r.tried === 0) return null
                  return (
                    <li key={k} className="flex justify-between gap-3">
                      <span>{kindSummaryLabel(k)}</span>
                      <span className="text-white/55">
                        {r.correct}/{r.tried} correct
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
            <button
              type="button"
              onClick={startNewLesson}
              className="rounded-2xl border border-violet-400/45 bg-violet-500/20 px-8 py-3 text-sm font-medium text-violet-50 hover:bg-violet-500/30"
            >
              New lesson
            </button>
          </motion.div>
        ) : card ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={card.index}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="flex flex-1 flex-col gap-6"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-100/95">
                    {card.topic}
                  </span>
                  <button
                    type="button"
                    onClick={() => openSheet("tables")}
                    className="rounded-full border border-amber-400/35 bg-amber-500/12 px-2.5 py-1 text-[11px] font-medium text-amber-100/95 hover:bg-amber-500/18"
                  >
                    Tables
                  </button>
                  <button
                    type="button"
                    onClick={() => openSheet("glossary")}
                    className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100/90 hover:bg-cyan-500/16"
                  >
                    Terms
                  </button>
                </div>
                <p className="text-lg leading-snug text-white/95">{card.prompt}</p>
                {card.hint ? (
                  <p
                    className={`rounded-xl border px-3 py-3 text-base leading-relaxed ${
                      card.kind === "gloss_lemma_to_en"
                        ? "border-amber-400/25 bg-amber-500/10 font-serif text-amber-50/95"
                        : card.kind === "gloss_en_to_lemma"
                          ? "border-cyan-400/22 bg-cyan-950/30 text-cyan-50/90"
                          : "border-white/10 bg-white/[0.04] text-amber-100/90"
                    }`}
                  >
                    {card.kind === "gloss_en_to_lemma" ? (
                      <>
                        <span className="text-[11px] font-sans text-white/45">Gloss · </span>
                        <span className="font-medium">“{card.hint}”</span>
                      </>
                    ) : (
                      card.hint
                    )}
                  </p>
                ) : null}
                {showRetryHint ? (
                  <p className="text-sm text-amber-200/85">Not quite — one more try. Half XP if you get it on this pick.</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-3">
                {card.options.map((opt, i) => {
                  const isSel = selected === i
                  const isCorrect = i === card.correctIndex
                  let btnClass =
                    "w-full rounded-2xl border px-4 py-4 text-left text-base transition-colors sm:py-5 "
                  if (revealed) {
                    if (isCorrect) btnClass += "border-emerald-400/50 bg-emerald-500/20 text-emerald-50 "
                    else if (isSel) btnClass += "border-red-400/45 bg-red-500/15 text-red-100 "
                    else btnClass += "border-white/10 bg-white/[0.03] text-white/40 "
                  } else if (wrongCount === 1 && isSel && !isCorrect) {
                    btnClass +=
                      "border-amber-400/35 bg-amber-500/10 text-amber-50/90 line-through decoration-white/30 "
                  } else {
                    btnClass +=
                      "border-white/15 bg-white/[0.06] text-white/90 hover:border-violet-400/35 hover:bg-violet-500/10 "
                  }
                  const disabled = revealed || (wrongCount === 1 && isSel && !isCorrect)
                  return (
                    <motion.button
                      key={`${card.index}-${i}-${opt}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChoose(i)}
                      className={btnClass}
                      whileTap={disabled ? undefined : { scale: 0.985 }}
                      animate={
                        revealed && isCorrect
                          ? { scale: [1, 1.04, 1] }
                          : revealed && isSel && !isCorrect
                            ? { x: [0, -5, 5, -3, 0] }
                            : { scale: 1, x: 0 }
                      }
                      transition={{ duration: 0.38, ease: "easeOut" }}
                    >
                      {opt}
                    </motion.button>
                  )
                })}
              </div>
              {revealed ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-white/60">{card.explainer}</p>
                  {card.kind === "morph" && card.passageRef ? (
                    <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs text-white/50">
                      Verse: {card.passageRef}
                    </p>
                  ) : null}
                  {wrongCount === 1 && selected === card.correctIndex ? (
                    <p className="text-xs text-white/45">Second-try correct: half XP for this card.</p>
                  ) : null}
                  {wrongCount >= 1 && selected !== card.correctIndex ? (
                    <p className="text-xs text-white/45">No XP this card — review the note and keep going.</p>
                  ) : null}
                  {wrongCount >= 1 ? (
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/25 px-3 py-3">
                      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-200/85">
                        Study coach — tap a prompt
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                        Uses your saved progress on this device. No typing required.
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {LESSON_COACH_QUICK_PROMPTS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            disabled={lessonCoachLoading}
                            onClick={() => void askLessonCoach(p.question)}
                            className="min-h-[44px] rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2 py-2 text-center text-[12px] font-medium leading-snug text-emerald-50 hover:bg-emerald-500/22 disabled:opacity-50"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      {lessonCoachLoading ? (
                        <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
                          <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
                          Coach is thinking…
                        </div>
                      ) : null}
                      {lessonCoachError ? (
                        <p className="mt-2 text-xs text-amber-200/90">{lessonCoachError}</p>
                      ) : null}
                      {lessonCoachReply ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/88">{lessonCoachReply}</p>
                      ) : null}
                      {lessonCoachFollowUps.length > 0 && !lessonCoachLoading ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {lessonCoachFollowUps.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              disabled={lessonCoachLoading}
                              onClick={() => void askLessonCoach(chip)}
                              className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/[0.1] disabled:opacity-50"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={onContinue}
                    className="w-full rounded-2xl border border-violet-400/45 bg-violet-500/25 py-3.5 text-sm font-medium text-white hover:bg-violet-500/35"
                  >
                    Continue
                  </button>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>
    </PracticeLayout>
  )
}
