"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Sparkles } from "lucide-react"

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
} from "@/lib/devotions-greek-word-memory"
import { normalizeGreekLemma } from "@/lib/bible/greek-lemma-english-quiz"
import {
  playQuestFeedbackSound,
  todayDateKey,
  vibrateQuest,
} from "@/app/devotions/greek/greek-verse-quest-logic"

import { PracticeLayout } from "@/app/devotions/greek/greek-practice-layout"

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

export function GreekLessonLabClient() {
  const { prefs: uiPrefs } = useGreekUiPreferences()
  const { hapticsEnabled, soundEffectsEnabled } = uiPrefs
  const [sessionSeed, setSessionSeed] = useState(() => Math.floor(Math.random() * 2 ** 30))
  const [menuOpen, setMenuOpen] = useState(false)
  const [cards, setCards] = useState<LessonCard[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  /** Wrong picks before the final reveal for this card (0 = no miss yet, 1 = one miss, still answering or resolved) */
  const [wrongCount, setWrongCount] = useState(0)
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
        awardCard(card, mult)
        bumpResult(card.kind, true)
      } else {
        vibrateQuest("incorrect", { hapticsEnabled })
        playQuestFeedbackSound("incorrect", { soundEnabled: soundEffectsEnabled })
        if (wrongCount === 0) {
          setWrongCount(1)
          setSelected(optionIndex)
        } else {
          setSelected(optionIndex)
          setRevealed(true)
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
    setIndex((i) => i + 1)
  }, [cards])

  const startNewLesson = useCallback(() => {
    setSessionSeed(Math.floor(Math.random() * 2 ** 30))
  }, [])

  const showRetryHint = wrongCount === 1 && !revealed

  return (
    <PracticeLayout
      title="Lesson"
      accent="violet"
      onMenu={() => setMenuOpen(true)}
      menuLabel="Study menu"
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
        title="Lesson menu"
        accent="violet"
      >
        <div className="space-y-4 px-1">
          <GreekMenuSection label="Practice">
            <div className="flex flex-col gap-2">
              <Link
                href="/devotions/greek/quest"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl border border-emerald-400/35 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-100 hover:bg-emerald-500/18"
              >
                Verse Quest
              </Link>
              <Link
                href="/devotions/greek/endings"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl border border-amber-400/35 bg-amber-500/12 px-4 py-3 text-sm text-amber-100 hover:bg-amber-500/18"
              >
                Endings Lab
              </Link>
              <Link
                href="/devotions/greek/english-search"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl border border-violet-400/35 bg-violet-500/12 px-4 py-3 text-sm text-violet-100 hover:bg-violet-500/18"
              >
                English word search
              </Link>
              <Link
                href="/devotions/greek/words"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-white/80 hover:bg-white/[0.1]"
              >
                Word bank
              </Link>
            </div>
          </GreekMenuSection>
          <p className="px-1 text-xs leading-relaxed text-white/50">
            Each run mixes endings, vocabulary both ways, and real verse morphology. Two tries on vocabulary and grammar
            cards: full XP on the first correct pick, half XP if you need a second try.
          </p>
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
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={startNewLesson}
                className="rounded-2xl border border-violet-400/45 bg-violet-500/20 px-8 py-3 text-sm font-medium text-violet-50 hover:bg-violet-500/30"
              >
                New lesson
              </button>
              <Link
                href="/devotions/greek/words"
                className="rounded-2xl border border-white/15 bg-white/[0.06] px-8 py-3 text-center text-sm font-medium text-white/85 hover:bg-white/[0.1]"
              >
                Review word bank
              </Link>
            </div>
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
                    <button
                      key={`${card.index}-${i}-${opt}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChoose(i)}
                      className={btnClass}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
              {revealed ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-white/60">{card.explainer}</p>
                  {wrongCount === 1 && selected === card.correctIndex ? (
                    <p className="text-xs text-white/45">Second-try correct: half XP for this card.</p>
                  ) : null}
                  {wrongCount >= 1 && selected !== card.correctIndex ? (
                    <p className="text-xs text-white/45">No XP this card — review the note and keep going.</p>
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
