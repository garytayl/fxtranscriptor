"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react"

import { PracticeLayout } from "@/app/devotions/greek/greek-practice-layout"
import { GreekSectionQuickNav } from "@/app/devotions/greek/greek-section-quick-nav"
import { recordGreekStudyEvent } from "@/lib/devotions-greek-progress"
import { buildEndingsQuestChoices } from "@/lib/greek-endings-quest-utils"
import { ENDINGS_QUESTS } from "@/lib/greek-endings-quest-data"
import { GrammarGlossaryTerms } from "@/app/devotions/greek/grammar-glossary-terms"
import { ENDINGS_SECTIONS, ENDINGS_TABLES } from "@/lib/greek-endings-reference"

export { ENDINGS_SECTIONS, ENDINGS_TABLES, type EndingsSection } from "@/lib/greek-endings-reference"
export { buildEndingsQuestChoices, buildEndingsQuestKey } from "@/lib/greek-endings-quest-utils"

type EndingsGroup = "verb" | "noun" | "article"
type EndingsGroupFilter = EndingsGroup | "all"

type EndingsLabState = {
  answeredQuestIds: string[]
  correctStreak: number
  totalCorrect: number
  totalAttempts: number
}

const ENDINGS_LAB_STORAGE_KEY = "fx_devotions_greek_endings_lab_v1"

const defaultState: EndingsLabState = {
  answeredQuestIds: [],
  correctStreak: 0,
  totalCorrect: 0,
  totalAttempts: 0,
}

function parseStoredState(raw: string | null): EndingsLabState {
  if (!raw) return defaultState
  try {
    const parsed = JSON.parse(raw) as Partial<EndingsLabState>
    return {
      answeredQuestIds: Array.isArray(parsed.answeredQuestIds)
        ? parsed.answeredQuestIds.filter((id): id is string => typeof id === "string")
        : [],
      correctStreak: typeof parsed.correctStreak === "number" ? Math.max(0, Math.floor(parsed.correctStreak)) : 0,
      totalCorrect: typeof parsed.totalCorrect === "number" ? Math.max(0, Math.floor(parsed.totalCorrect)) : 0,
      totalAttempts: typeof parsed.totalAttempts === "number" ? Math.max(0, Math.floor(parsed.totalAttempts)) : 0,
    }
  } catch {
    return defaultState
  }
}

export function GreekEndingsLabClient() {
  const [groupFilter, setGroupFilter] = useState<EndingsGroupFilter>("all")
  const [labState, setLabState] = useState<EndingsLabState>(defaultState)
  const [activeQuestId, setActiveQuestId] = useState<string | null>(ENDINGS_QUESTS[0]?.id ?? null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [awardedXp, setAwardedXp] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    setLabState(parseStoredState(window.localStorage.getItem(ENDINGS_LAB_STORAGE_KEY)))
  }, [])

  const saveLabState = useCallback((next: EndingsLabState) => {
    setLabState(next)
    if (typeof window === "undefined") return
    window.localStorage.setItem(ENDINGS_LAB_STORAGE_KEY, JSON.stringify(next))
  }, [])

  const filteredQuests = useMemo(() => {
    if (groupFilter === "all") return ENDINGS_QUESTS
    return ENDINGS_QUESTS.filter((q) => q.group === groupFilter)
  }, [groupFilter])

  useEffect(() => {
    if (filteredQuests.length === 0) {
      setActiveQuestId(null)
      return
    }
    if (!activeQuestId || !filteredQuests.some((q) => q.id === activeQuestId)) {
      setActiveQuestId(filteredQuests[0]?.id ?? null)
      setSelectedOption(null)
      setResultMessage(null)
      setAwardedXp(null)
    }
  }, [filteredQuests, activeQuestId])

  const activeQuest =
    filteredQuests.find((q) => q.id === activeQuestId) ??
    filteredQuests[0] ??
    ENDINGS_QUESTS[0] ??
    null

  const answeredSet = useMemo(() => new Set(labState.answeredQuestIds), [labState.answeredQuestIds])
  const completedFilteredCount = useMemo(
    () => filteredQuests.reduce((acc, q) => acc + (answeredSet.has(q.id) ? 1 : 0), 0),
    [filteredQuests, answeredSet],
  )

  const pickNextQuest = useCallback(() => {
    if (filteredQuests.length === 0) return
    const unanswered = filteredQuests.filter((q) => !answeredSet.has(q.id))
    const pool = unanswered.length > 0 ? unanswered : filteredQuests
    const currentIndex = pool.findIndex((q) => q.id === activeQuest?.id)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % pool.length : 0
    setActiveQuestId(pool[nextIndex]?.id ?? pool[0]?.id ?? null)
    setSelectedOption(null)
    setResultMessage(null)
    setAwardedXp(null)
  }, [filteredQuests, answeredSet, activeQuest?.id])

  const submitQuestAnswer = useCallback(() => {
    if (!activeQuest || !selectedOption) return
    const isCorrect = selectedOption === activeQuest.answer
    const nextAnswered = answeredSet.has(activeQuest.id)
      ? labState.answeredQuestIds
      : [activeQuest.id, ...labState.answeredQuestIds]
    const eventKey = `endings-quest-${activeQuest.id}`
    const { awardedXp: xp } = isCorrect
      ? recordGreekStudyEvent({ kind: "session", key: eventKey, xp: activeQuest.xp })
      : { awardedXp: 0 }
    saveLabState({
      answeredQuestIds: nextAnswered,
      correctStreak: isCorrect ? labState.correctStreak + 1 : 0,
      totalCorrect: isCorrect ? labState.totalCorrect + 1 : labState.totalCorrect,
      totalAttempts: labState.totalAttempts + 1,
    })
    setResultMessage(isCorrect ? "Correct. Endings memory growing." : "Not quite. Review the table and fire again.")
    setAwardedXp(xp > 0 ? xp : null)
  }, [activeQuest, answeredSet, labState, saveLabState, selectedOption])

  const progressSlot = (
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-white/78 sm:text-sm">
      <span>
        Drills {completedFilteredCount}/{Math.max(filteredQuests.length, 1)} · Streak {labState.correctStreak}
      </span>
      <Link href="/devotions/greek/lesson" className="text-amber-200/95 hover:text-amber-100">
        Mixed lesson →
      </Link>
    </div>
  )

  return (
    <PracticeLayout title="Endings lab" accent="amber" progressSlot={progressSlot}>
      <main className="mx-auto w-full max-w-6xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-8">
        <section className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
          <p className="text-sm text-white/85">
            <strong className="font-medium text-white/95">Path:</strong> Endings (here) → Grammar Reader (explore verses)
            → Verse Quest (drills &amp; XP) → Word bank (review forms). Jump anywhere below.
          </p>
          <div className="mt-4">
            <GreekSectionQuickNav />
          </div>
          <div className="mt-4">
            <Link
              href="/bible"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/80 hover:bg-white/[0.1] sm:w-auto"
            >
              <ArrowLeft className="size-4 rotate-180" />
              Scripture Reader
            </Link>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {ENDINGS_TABLES.map((table) => (
            <article key={table.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/75">{table.title}</p>
                <p className="mt-1 text-sm text-white/72">{table.subtitle}</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                  <thead className="bg-white/[0.03]">
                    <tr>
                      {table.columns.map((column) => (
                        <th key={column} className="border-b border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/65">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={`${table.id}-row-${rowIndex}`} className="odd:bg-white/[0.01]">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${table.id}-row-${rowIndex}-cell-${cellIndex}`}
                            className="border-b border-white/5 px-3 py-2.5 text-white/88"
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
        </section>

        <section className="mt-6">
          <GrammarGlossaryTerms layout="grid" showIntro />
        </section>

        <section className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 sm:p-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-200/85">Ending quests only</p>
            <p className="mt-1 text-sm text-white/82">Quick recall prompts just for endings patterns.</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["all", "verb", "noun", "article"] as EndingsGroupFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setGroupFilter(filter)}
                className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                  groupFilter === filter
                    ? "border border-emerald-300/45 bg-emerald-400/15 text-emerald-100"
                    : "border border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {filter === "all" ? "All endings" : `${filter} endings`}
              </button>
            ))}
          </div>

          {activeQuest ? (
            <div className="mt-4 rounded-xl border border-white/12 bg-black/35 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/58">
                {activeQuest.group} question · {Math.min(completedFilteredCount + 1, Math.max(filteredQuests.length, 1))} of{" "}
                {Math.max(filteredQuests.length, 1)}
              </p>
              <p className="mt-2 text-sm text-white/92">{activeQuest.prompt}</p>
              {(() => {
                const choices = buildEndingsQuestChoices(activeQuest)
                return (
                  <>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {choices.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSelectedOption(option)}
                          className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                            selectedOption === option
                              ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
                              : "border-white/15 bg-white/[0.03] text-white/84 hover:bg-white/[0.08]"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={submitQuestAnswer}
                        disabled={selectedOption == null}
                        className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-emerald-300/45 bg-emerald-500/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-4" />
                        Check answer
                      </button>
                      <button
                        type="button"
                        onClick={pickNextQuest}
                        className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-white/20 bg-white/[0.05] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/80 hover:bg-white/[0.1]"
                      >
                        Next quest
                      </button>
                    </div>
                  </>
                )
              })()}
              {resultMessage ? (
                <div className="mt-3 rounded-lg border border-white/12 bg-black/30 p-3">
                  <p className="text-sm text-white/92">{resultMessage}</p>
                  <p className="mt-1 text-xs text-white/70">{activeQuest.explainer}</p>
                  {awardedXp ? (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-200/90">+{awardedXp} XP</p>
                  ) : (
                    <p className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
                      <XCircle className="size-3.5" />
                      No XP this attempt
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/70">No quests available for this filter.</p>
          )}

          <p className="mt-4 text-xs text-white/60">
            Accuracy:{" "}
            {labState.totalAttempts > 0 ? `${Math.round((labState.totalCorrect / labState.totalAttempts) * 100)}%` : "0%"} ·
            Correct: {labState.totalCorrect} / {labState.totalAttempts}
          </p>
        </section>
      </main>
    </PracticeLayout>
  )
}
