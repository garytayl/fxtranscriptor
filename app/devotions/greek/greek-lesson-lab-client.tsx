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
} from "@/lib/greek-lesson-session"
import { recordGreekStudyEvent } from "@/lib/devotions-greek-progress"
import { useGreekUiPreferences } from "@/lib/devotions-greek-ui-preferences"
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
          className={`h-1 flex-1 rounded-full transition-colors ${
            i < current ? accent : "bg-white/12"
          }`}
        />
      ))}
    </div>
  )
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
  const [phase, setPhase] = useState<"pick" | "revealed">("pick")
  const [sessionXp, setSessionXp] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const todayKey = useMemo(() => todayDateKey(), [])
  const { runId, drafts } = useMemo(() => buildLessonDrafts(sessionSeed), [sessionSeed])

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
          setPhase("pick")
          setSessionXp(0)
          setCorrectCount(0)
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

  const awardCard = useCallback(
    (c: LessonCard, correct: boolean) => {
      if (correct) {
        const key = lessonSessionKey(todayKey, runId, c.index, c.kind)
        const { awardedXp } = recordGreekStudyEvent({ kind: "session", key, xp: c.xp })
        setSessionXp((x) => x + awardedXp)
        setCorrectCount((n) => n + 1)
      }
    },
    [runId, todayKey],
  )

  const onChoose = useCallback(
    (optionIndex: number) => {
      if (!card || phase !== "pick") return
      setSelected(optionIndex)
      setPhase("revealed")
      const correct = optionIndex === card.correctIndex
      if (correct) {
        vibrateQuest("correct", { hapticsEnabled })
        playQuestFeedbackSound("correct", { soundEnabled: soundEffectsEnabled })
      } else {
        vibrateQuest("incorrect", { hapticsEnabled })
        playQuestFeedbackSound("incorrect", { soundEnabled: soundEffectsEnabled })
      }
      awardCard(card, correct)
    },
    [card, phase, awardCard, hapticsEnabled, soundEffectsEnabled],
  )

  const onContinue = useCallback(() => {
    if (!cards) return
    setSelected(null)
    setPhase("pick")
    setIndex((i) => i + 1)
  }, [cards])

  const startNewLesson = useCallback(() => {
    setSessionSeed(Math.floor(Math.random() * 2 ** 30))
  }, [])

  const kindLabel =
    card?.kind === "endings" ? "Endings" : card?.kind === "gloss_en_to_lemma" ? "Vocabulary" : "Verse grammar"

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
                href="/devotions/greek/words"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-white/80 hover:bg-white/[0.1]"
              >
                Word bank
              </Link>
            </div>
          </GreekMenuSection>
        </div>
      </GreekStudyMenuShell>

      <div className="mx-auto flex min-h-full max-w-lg flex-col px-4 pb-16 pt-8 sm:px-6">
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
              className="flex flex-1 flex-col gap-8"
            >
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-violet-300/75">{kindLabel}</p>
                <p className="mt-3 text-lg leading-snug text-white/95">{card.prompt}</p>
                {card.hint ? (
                  <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-amber-100/90">
                    {card.hint}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-3">
                {card.options.map((opt, i) => {
                  const isSel = selected === i
                  const isCorrect = i === card.correctIndex
                  let btnClass =
                    "w-full rounded-2xl border px-4 py-4 text-left text-base transition-colors sm:py-5 "
                  if (phase === "revealed") {
                    if (isCorrect) btnClass += "border-emerald-400/50 bg-emerald-500/20 text-emerald-50 "
                    else if (isSel) btnClass += "border-red-400/45 bg-red-500/15 text-red-100 "
                    else btnClass += "border-white/10 bg-white/[0.03] text-white/40 "
                  } else {
                    btnClass +=
                      "border-white/15 bg-white/[0.06] text-white/90 hover:border-violet-400/35 hover:bg-violet-500/10 "
                  }
                  return (
                    <button
                      key={`${card.index}-${i}-${opt}`}
                      type="button"
                      disabled={phase !== "pick"}
                      onClick={() => onChoose(i)}
                      className={btnClass}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
              {phase === "revealed" ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/55">{card.explainer}</p>
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
