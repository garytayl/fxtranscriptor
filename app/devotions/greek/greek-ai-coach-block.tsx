"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Lightbulb } from "lucide-react"

import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { expandGreekMorphToken } from "@/lib/bible/robinson-greek"
import { recordGreekStudyEvent } from "@/lib/devotions-greek-progress"

const COACH_XP = 16

type GreekCoachPayload = {
  insight: string
  microGloss?: string
  grammarHook?: string
  prayerPrompt?: string
}

export function GreekAiCoachBlock({
  passageRef,
  levelKey,
  wordIndex,
  english,
  verseGreekLine,
  token,
  variant = "amber",
  onXpAwarded,
}: {
  passageRef: string
  levelKey: string
  wordIndex: number
  english: string
  verseGreekLine: string
  token: GreekMorphToken
  variant?: "amber" | "emerald"
  onXpAwarded?: (amount: number) => void
}) {
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [coachPayload, setCoachPayload] = useState<GreekCoachPayload | null>(null)
  const [coachTokenKey, setCoachTokenKey] = useState<string | null>(null)

  const activeCoachKey = useMemo(
    () => `${levelKey}-${wordIndex}-${token.word}-${token.lemma}`,
    [levelKey, wordIndex, token.word, token.lemma],
  )

  useEffect(() => {
    setCoachPayload(null)
    setCoachError(null)
    setCoachLoading(false)
    setCoachTokenKey(null)
  }, [activeCoachKey])

  const runCoach = useCallback(async () => {
    if (!activeCoachKey || coachLoading) return
    if (coachTokenKey === activeCoachKey) return
    setCoachLoading(true)
    setCoachError(null)
    try {
      const expanded = expandGreekMorphToken(token)
      const response = await fetch("/api/devotions/greek-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: passageRef,
          greekWord: token.word,
          lemma: token.lemma,
          parse: token.parse,
          category: expanded?.posLabel ?? token.pos,
          parseSummary: expanded?.parseSummary ?? token.parse,
          english,
          verseGreek: verseGreekLine,
          userQuestion:
            "What should I notice in the spelling of this word (endings, letters) and how does that match the parse?",
        }),
      })
      const data = (await response.json()) as
        | {
            insight?: string
            microGloss?: string
            grammarHook?: string
            prayerPrompt?: string
            error?: string
          }
        | undefined
      if (!response.ok || !data?.insight) {
        throw new Error(data?.error || "Coach insight unavailable right now.")
      }
      setCoachPayload({
        insight: data.insight,
        microGloss: data.microGloss,
        grammarHook: data.grammarHook,
        prayerPrompt: data.prayerPrompt,
      })
      setCoachTokenKey(activeCoachKey)

      const { awardedXp } = recordGreekStudyEvent({
        kind: "coach",
        key: `${levelKey}-coach-${wordIndex}`,
        xp: COACH_XP,
      })
      if (awardedXp > 0) onXpAwarded?.(awardedXp)
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Coach insight unavailable right now.")
    } finally {
      setCoachLoading(false)
    }
  }, [activeCoachKey, coachLoading, coachTokenKey, english, levelKey, onXpAwarded, passageRef, token, verseGreekLine, wordIndex])

  const border =
    variant === "emerald"
      ? "border-emerald-200/25 bg-black/25"
      : "border-amber-400/30 bg-black/25"

  const labelColor =
    variant === "emerald" ? "text-emerald-100/85" : "text-amber-100/85"

  const buttonClass =
    variant === "emerald"
      ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-50 hover:bg-emerald-400/30"
      : "border-amber-300/40 bg-amber-400/20 text-amber-50 hover:bg-amber-400/30"

  return (
    <div className={`mt-2 rounded-lg border p-2.5 ${border}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${labelColor}`}>AI Coach</p>
        <button
          type="button"
          onClick={() => void runCoach()}
          disabled={coachLoading}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] disabled:opacity-60 ${buttonClass}`}
        >
          <Lightbulb className="size-3.5" />
          {coachLoading ? "Thinking" : "Hint"}
        </button>
      </div>
      {coachError ? <p className="mt-2 text-xs text-red-200/90">{coachError}</p> : null}
      {coachPayload ? (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-white/88">{coachPayload.insight}</p>
          {coachPayload.grammarHook ? (
            <p className="text-[11px] text-cyan-100/90">Grammar hook: {coachPayload.grammarHook}</p>
          ) : null}
          {coachPayload.microGloss ? (
            <p className="text-[11px] text-white/70">Micro gloss: {coachPayload.microGloss}</p>
          ) : null}
          {coachPayload.prayerPrompt ? (
            <p className="text-[11px] text-amber-100/75 italic leading-snug">{coachPayload.prayerPrompt}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
