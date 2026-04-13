"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import clsx from "clsx"
import { Copy, Lightbulb, RefreshCw, Sparkles, Trash2 } from "lucide-react"
import { motion } from "framer-motion"

import type { GreekMorphToken } from "@/lib/bible/morph-types"
import type { GreekWordLearningClues } from "@/lib/bible/greek-word-learning-clues"
import type { GreekProgressEvent } from "@/lib/devotions-greek-progress"

const COACH_XP = 20
const COACH_HISTORY_LIMIT = 6

const POS_LABELS: Record<string, string> = {
  N: "Noun",
  V: "Verb",
  A: "Adjective",
  D: "Adverb",
  P: "Pronoun",
  R: "Article / Pronoun",
  C: "Conjunction",
  I: "Interjection",
  T: "Particle",
}

type GreekCoachPayload = {
  insight: string
  prayerPrompt?: string
  microGloss?: string
  grammarHook?: string
  reflectionPrompt?: string
}

type CoachHistoryItem = {
  id: string
  question: string
  insight: string
}

type CoachQuickAction = {
  id: string
  label: string
  prompt: string
}

export function GreekCoachLab({
  levelKey,
  passageRef,
  english,
  verseGreekLine,
  selectedToken,
  wordIndex,
  learningClues,
  awardProgress,
  className,
}: {
  levelKey: string
  passageRef: string
  english: string
  verseGreekLine: string
  selectedToken: GreekMorphToken
  wordIndex: number
  learningClues: GreekWordLearningClues | null
  /** Returns awarded XP for this event (0 if duplicate key today). */
  awardProgress: (event: GreekProgressEvent) => number
  /** Extra classes on the outer card (e.g. top margin when below morphology). */
  className?: string
}) {
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [coachPayload, setCoachPayload] = useState<GreekCoachPayload | null>(null)
  const [coachTokenKey, setCoachTokenKey] = useState<string | null>(null)
  const [coachQuestion, setCoachQuestion] = useState("")
  const [coachHistory, setCoachHistory] = useState<CoachHistoryItem[]>([])
  const [coachCopied, setCoachCopied] = useState(false)

  const activeCoachKey = `${levelKey}-${wordIndex}-${selectedToken.word}`
  const defaultCoachQuestion = learningClues?.articleFunctionHint
    ? "What is the article doing here?"
    : "Why is this form parsed this way?"
  const coachMicroFocus = learningClues?.parseTemplate ?? selectedToken.parse ?? ""

  const quickActions = useMemo<CoachQuickAction[]>(
    () => [
      { id: "article", label: "Article", prompt: "What is this article doing in this phrase?" },
      { id: "syntax", label: "Syntax role", prompt: "What role does this word play in the sentence?" },
      { id: "case", label: "Case logic", prompt: "Why this case here, and what does it signal?" },
      { id: "tense", label: "Tense force", prompt: "What force does this tense/aspect add in context?" },
      { id: "compare", label: "Compare forms", prompt: "How would the meaning change if a different form were used?" },
      { id: "memory", label: "Memory hook", prompt: "Give me a memory hook for this exact form." },
      { id: "prayer", label: "Prayer bridge", prompt: "Turn this grammar insight into a short prayer prompt." },
    ],
    [],
  )

  const coachCanAsk = Boolean(selectedToken && activeCoachKey && !coachLoading)

  useEffect(() => {
    if (coachTokenKey?.startsWith(`${activeCoachKey}|`)) return
    setCoachPayload(null)
    setCoachError(null)
    setCoachQuestion("")
    setCoachHistory([])
    setCoachCopied(false)
  }, [activeCoachKey, coachTokenKey])

  const runCoach = useCallback(
    async (explicitQuestion?: string) => {
      if (!selectedToken || !activeCoachKey || coachLoading) return
      const resolvedQuestion = (explicitQuestion ?? coachQuestion).trim()
      const requestKey = `${activeCoachKey}|${resolvedQuestion.toLowerCase()}`
      if (coachTokenKey === requestKey && coachPayload) return
      setCoachLoading(true)
      setCoachError(null)
      setCoachCopied(false)
      try {
        const response = await fetch("/api/devotions/greek-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: passageRef,
            greekWord: selectedToken.word,
            lemma: selectedToken.lemma,
            parse: selectedToken.parse,
            category: POS_LABELS[(selectedToken.pos || "").trim().charAt(0)] ?? selectedToken.pos,
            parseSummary: learningClues?.quickReason ?? selectedToken.parse,
            english,
            verseGreek: verseGreekLine,
            userQuestion: resolvedQuestion || undefined,
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
          throw new Error(data?.error || "Coach insight unavailable right now.")
        }
        const nextPayload: GreekCoachPayload = {
          insight: insight.trim(),
          prayerPrompt: prayerPrompt.trim(),
          microGloss: typeof data?.microGloss === "string" ? data.microGloss.trim() : undefined,
          grammarHook: typeof data?.grammarHook === "string" ? data.grammarHook.trim() : undefined,
          reflectionPrompt: typeof data?.reflectionPrompt === "string" ? data.reflectionPrompt.trim() : undefined,
        }
        setCoachPayload(nextPayload)
        setCoachTokenKey(requestKey)
        setCoachHistory((prev) => {
          const nextItem: CoachHistoryItem = {
            id: requestKey,
            question: resolvedQuestion || "Coach me",
            insight: nextPayload.insight,
          }
          return [nextItem, ...prev.filter((entry) => entry.id !== requestKey)].slice(0, COACH_HISTORY_LIMIT)
        })
        awardProgress({
          kind: "coach",
          key: requestKey,
          xp: COACH_XP,
        })
      } catch (err) {
        setCoachError(err instanceof Error ? err.message : "Coach insight unavailable right now.")
      } finally {
        setCoachLoading(false)
      }
    },
    [
      selectedToken,
      activeCoachKey,
      coachLoading,
      coachTokenKey,
      coachPayload,
      coachQuestion,
      passageRef,
      english,
      verseGreekLine,
      learningClues?.quickReason,
      awardProgress,
    ],
  )

  const handleAskCoach = useCallback(
    (prompt?: string) => {
      if (!coachCanAsk) return
      if (typeof prompt === "string") {
        setCoachQuestion(prompt)
      }
      void runCoach(prompt)
    },
    [coachCanAsk, runCoach],
  )

  const copyCoachInsight = useCallback(async () => {
    if (!coachPayload || typeof navigator === "undefined" || !navigator.clipboard) return
    const lines = [
      `Word: ${selectedToken.word}`,
      `Question: ${coachQuestion.trim() || "Coach me"}`,
      `Insight: ${coachPayload.insight}`,
      `Prayer Prompt: ${coachPayload.prayerPrompt ?? ""}`,
    ]
    if (coachPayload.grammarHook) lines.push(`Grammar Hook: ${coachPayload.grammarHook}`)
    if (coachPayload.microGloss) lines.push(`Micro Gloss: ${coachPayload.microGloss}`)
    if (coachPayload.reflectionPrompt) lines.push(`Reflection Prompt: ${coachPayload.reflectionPrompt}`)
    await navigator.clipboard.writeText(lines.join("\n"))
    setCoachCopied(true)
    window.setTimeout(() => setCoachCopied(false), 1500)
  }, [coachPayload, selectedToken.word, coachQuestion])

  const clearCoachHistory = useCallback(() => {
    setCoachHistory([])
  }, [])

  return (
    <div
      className={clsx(
        "flex flex-col gap-5 rounded-2xl border border-emerald-300/25 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(3,14,20,0.55))] p-4 shadow-[0_10px_30px_rgba(16,185,129,0.12)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/85">AI Greek Coach Lab</p>
          <p className="mt-1 text-xs leading-relaxed text-white/65">Quick actions, follow-up prompts, and re-ask history.</p>
        </div>
        <button
          type="button"
          onClick={() => handleAskCoach()}
          disabled={!coachCanAsk}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/45 bg-emerald-400/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-50 hover:bg-emerald-400/35 disabled:opacity-60"
        >
          <Lightbulb className="size-3.5" />
          {coachLoading ? "Thinking..." : "Coach me"}
        </button>
      </div>

      <div className="rounded-xl border border-white/15 bg-black/25 p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Current focus</p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/82">
          {selectedToken.word} ({selectedToken.lemma}) — {coachMicroFocus}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={coachQuestion}
            onChange={(e) => setCoachQuestion(e.target.value)}
            placeholder="Ask a follow-up in plain English..."
            className="flex-1 rounded-xl border border-emerald-300/35 bg-black/35 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-emerald-200/60 focus:outline-none"
            aria-label="Ask AI Greek coach a question"
          />
          <button
            type="button"
            onClick={() => handleAskCoach()}
            disabled={!coachCanAsk}
            className="rounded-xl border border-emerald-300/45 bg-emerald-400/20 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-100 hover:bg-emerald-400/30 disabled:opacity-60"
          >
            Ask
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAskCoach(action.prompt)}
              disabled={!coachCanAsk}
              className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[11px] text-white/80 hover:bg-black/30 disabled:opacity-60"
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleAskCoach(defaultCoachQuestion)}
            disabled={!coachCanAsk}
            className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1.5 text-[11px] text-emerald-100/90 hover:bg-emerald-300/20 disabled:opacity-60"
          >
            Deep dive this form
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleAskCoach(coachHistory[0]?.question)}
          disabled={!coachCanAsk || coachHistory.length === 0}
          className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[11px] text-white/80 hover:bg-black/30 disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" />
          Re-ask latest
        </button>
        <button
          type="button"
          onClick={() => void copyCoachInsight()}
          disabled={!coachPayload}
          className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[11px] text-white/80 hover:bg-black/30 disabled:opacity-50"
        >
          <Copy className="size-3.5" />
          {coachCopied ? "Copied" : "Copy insight"}
        </button>
        <button
          type="button"
          onClick={clearCoachHistory}
          disabled={coachHistory.length === 0}
          className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[11px] text-white/80 hover:bg-black/30 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
          Clear history
        </button>
      </div>

      {coachHistory.length > 0 ? (
        <div className="rounded-xl border border-white/15 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Recent coach prompts</p>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
              {coachHistory.length}/{COACH_HISTORY_LIMIT}
            </span>
          </div>
          <div className="space-y-2">
            {coachHistory.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAskCoach(item.question)}
                disabled={!coachCanAsk}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-left hover:bg-black/30 disabled:opacity-60"
              >
                <p className="text-[11px] text-white/85">{item.question}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-white/55">{item.insight}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {coachError ? (
        <p className="rounded-lg border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-200/95">{coachError}</p>
      ) : null}
      {coachLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-emerald-200/25 bg-black/30 p-3"
        >
          <div className="flex items-center gap-2 text-emerald-100">
            <Sparkles className="size-4 animate-pulse" />
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]">Coach is parsing the form</p>
          </div>
          <div className="mt-2 space-y-2">
            <motion.div
              className="h-3 rounded bg-emerald-300/20"
              animate={{ opacity: [0.45, 1, 0.45], x: [0, 6, 0] }}
              transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
            <motion.div
              className="h-3 w-5/6 rounded bg-cyan-300/20"
              animate={{ opacity: [0.4, 0.95, 0.4], x: [0, 8, 0] }}
              transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 0.12 }}
            />
          </div>
        </motion.div>
      ) : null}
      {coachPayload ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2.5 rounded-xl border border-emerald-200/25 bg-black/25 p-3"
        >
          <p className="text-sm leading-relaxed text-white/92">{coachPayload.insight}</p>
          {coachPayload.grammarHook ? (
            <p className="text-xs leading-relaxed text-cyan-100/90">Grammar hook: {coachPayload.grammarHook}</p>
          ) : null}
          {coachPayload.microGloss ? (
            <p className="text-xs leading-relaxed text-white/70">Micro gloss: {coachPayload.microGloss}</p>
          ) : null}
          {coachPayload.prayerPrompt ? (
            <p className="text-xs leading-relaxed text-emerald-100/95">{coachPayload.prayerPrompt}</p>
          ) : null}
          {coachPayload.reflectionPrompt ? (
            <p className="text-xs leading-relaxed text-emerald-200/85">Reflection: {coachPayload.reflectionPrompt}</p>
          ) : null}
        </motion.div>
      ) : !coachLoading && !coachError ? (
        <p className="text-xs leading-relaxed text-white/62">
          Tap quick actions to drill grammar, syntax, and prayer applications for this exact word.
        </p>
      ) : null}
    </div>
  )
}
