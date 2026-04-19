/**
 * Duolingo-style Greek lesson: deterministic draft builder + async morph hydration.
 */

import { buildChallengeForTarget, pickQuestTargetsInPhrase } from "@/app/devotions/greek/greek-verse-quest-logic"
import { GREEK_LEMMA_ENGLISH_QUIZ } from "@/lib/bible/greek-lemma-english-gloss.generated"
import { englishGlossForLemma, normalizeGreekLemma } from "@/lib/bible/greek-lemma-english-quiz"
import { MORPH_PILOT_CHAPTERS, morphPilotPassageRef } from "@/lib/bible/morph-pilot-menu"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { ENDINGS_QUESTS } from "@/lib/greek-endings-quest-data"

export const DEFAULT_LESSON_CARD_COUNT = 10
const ENDINGS_PER_RUN = 3
const GLOSS_PER_RUN = 4
const MORPH_PER_RUN = 3

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

export function lessonSessionKey(dateKey: string, runId: string, cardIndex: number, kind: string): string {
  return `greek-lesson-${dateKey}-${runId}-${cardIndex}-${kind}`
}

export type LessonDraft =
  | {
      kind: "endings"
      questId: string
      prompt: string
      options: string[]
      correctIndex: number
      xp: number
      explainer: string
    }
  | {
      kind: "gloss_en_to_lemma"
      prompt: string
      hint: string
      options: string[]
      correctIndex: number
      xp: number
      explainer: string
    }
  | {
      kind: "morph"
      passageRef: string
      xp: number
    }

export type LessonCard = {
  index: number
  kind: "endings" | "gloss_en_to_lemma" | "morph"
  prompt: string
  /** Secondary line (gloss text, or Greek word for morph) */
  hint?: string
  options: string[]
  correctIndex: number
  xp: number
  explainer: string
  endingsQuestId?: string
  passageRef?: string
}

function endingsDraftFromQuest(
  q: (typeof ENDINGS_QUESTS)[number],
  rng: () => number,
): Extract<LessonDraft, { kind: "endings" }> {
  const options = [q.answer, ...q.distractors]
  shuffleInPlace(options, rng)
  const correctIndex = options.indexOf(q.answer)
  return {
    kind: "endings",
    questId: q.id,
    prompt: q.prompt,
    options,
    correctIndex,
    xp: q.xp,
    explainer: q.explainer,
  }
}

function glossDraft(rng: () => number): Extract<LessonDraft, { kind: "gloss_en_to_lemma" }> {
  const lemmas = Object.keys(GREEK_LEMMA_ENGLISH_QUIZ).filter((l) => englishGlossForLemma(l))
  if (lemmas.length < 6) {
    return {
      kind: "gloss_en_to_lemma",
      prompt: "Which Greek word fits this gloss?",
      hint: "word",
      options: ["λόγος", "ἀγάπη", "πίστις", "ζωή"],
      correctIndex: 0,
      xp: 8,
      explainer: "λόγος → word",
    }
  }
  const pickIdx = Math.floor(rng() * lemmas.length)
  const correct = lemmas[pickIdx]
  const gloss = englishGlossForLemma(correct)!
  const pool = lemmas.filter((l) => l !== correct)
  shuffleInPlace(pool, rng)
  const wrong = pool.slice(0, 3)
  const options = [correct, ...wrong].map((l) => normalizeGreekLemma(l))
  const correctLemma = normalizeGreekLemma(correct)
  shuffleInPlace(options, rng)
  const correctIndex = options.indexOf(correctLemma)
  return {
    kind: "gloss_en_to_lemma",
    prompt: "Which Greek word fits this gloss?",
    hint: gloss,
    options,
    correctIndex,
    xp: 8,
    explainer: `${correctLemma} → ${gloss}`,
  }
}

function morphRefsForRun(rng: () => number, count: number): string[] {
  const refs: string[] = []
  for (let i = 0; i < count; i++) {
    const chapterIdx = Math.floor(rng() * MORPH_PILOT_CHAPTERS.length)
    const ch = MORPH_PILOT_CHAPTERS[chapterIdx]
    const verse = 1 + Math.floor(rng() * Math.max(1, ch.maxVerse))
    refs.push(morphPilotPassageRef(ch, verse))
  }
  return refs
}

/** Deterministic lesson draft list (morph entries need `finalizeLessonDrafts`). */
export function buildLessonDrafts(seed: number): { runId: string; drafts: LessonDraft[] } {
  const rng = mulberry32(seed)
  const runId = seed.toString(36)

  const endingsPool = [...ENDINGS_QUESTS]
  shuffleInPlace(endingsPool, rng)
  const endingsPicks = endingsPool.slice(0, Math.min(ENDINGS_PER_RUN, endingsPool.length))

  const drafts: LessonDraft[] = []
  for (const q of endingsPicks) {
    drafts.push(endingsDraftFromQuest(q, rng))
  }
  for (let g = 0; g < GLOSS_PER_RUN; g++) {
    drafts.push(glossDraft(rng))
  }
  for (const ref of morphRefsForRun(rng, MORPH_PER_RUN)) {
    drafts.push({ kind: "morph", passageRef: ref, xp: 8 })
  }

  shuffleInPlace(drafts, rng)
  return { runId, drafts }
}

function verseFromPassageRef(ref: string): number {
  const m = /:(\d+)\s*$/.exec(ref.trim())
  return m ? parseInt(m[1], 10) : 1
}

export async function fetchMorphTokensForRef(ref: string, verse: number): Promise<GreekMorphToken[]> {
  const morphRes = await fetch(`/api/bible/morph?ref=${encodeURIComponent(ref)}`)
  const morph = (await morphRes.json()) as {
    verses?: { number: number; tokens: GreekMorphToken[] }[]
    error?: string
    available?: boolean
  }
  if (!morphRes.ok) return []
  if (typeof morph.error === "string" && morph.error && morph.available === false) return []
  const mVerses = morph.verses
  const mv = mVerses?.find((x) => x.number === verse) ?? mVerses?.[0]
  return mv?.tokens ?? []
}

async function morphDraftToCard(draft: Extract<LessonDraft, { kind: "morph" }>, rng: () => number): Promise<LessonCard> {
  const verse = verseFromPassageRef(draft.passageRef)
  let tokens = await fetchMorphTokensForRef(draft.passageRef, verse)
  let pick = pickQuestTargetsInPhrase(tokens, new Set(), {}, false)
  let ref = draft.passageRef

  if (pick.targetIndexes.length === 0) {
    for (let attempt = 0; attempt < 6 && pick.targetIndexes.length === 0; attempt++) {
      const chapterIdx = Math.floor(rng() * MORPH_PILOT_CHAPTERS.length)
      const ch = MORPH_PILOT_CHAPTERS[chapterIdx]
      const v = 1 + Math.floor(rng() * Math.max(1, ch.maxVerse))
      ref = morphPilotPassageRef(ch, v)
      tokens = await fetchMorphTokensForRef(ref, v)
      pick = pickQuestTargetsInPhrase(tokens, new Set(), {}, false)
    }
  }

  if (pick.targetIndexes.length === 0) {
    const g = glossDraft(rng)
    return {
      index: 0,
      kind: "gloss_en_to_lemma",
      prompt: g.prompt,
      hint: g.hint,
      options: g.options,
      correctIndex: g.correctIndex,
      xp: draft.xp,
      explainer: g.explainer,
    }
  }

  const ti = pick.targetIndexes[Math.floor(rng() * pick.targetIndexes.length)]
  const ch = buildChallengeForTarget(tokens, ti)
  if (!ch) {
    const g = glossDraft(rng)
    return {
      index: 0,
      kind: "gloss_en_to_lemma",
      prompt: g.prompt,
      hint: g.hint,
      options: g.options,
      correctIndex: g.correctIndex,
      xp: draft.xp,
      explainer: g.explainer,
    }
  }

  const surface = tokens[ti]?.word ?? ""
  return {
    index: 0,
    kind: "morph",
    prompt: ch.prompt,
    hint: surface ? `“${surface}”` : undefined,
    options: ch.options,
    correctIndex: ch.correctOptionIndex,
    xp: draft.xp,
    explainer: `From ${ref}.`,
    passageRef: ref,
  }
}

function draftToStaticCard(
  draft: Extract<LessonDraft, { kind: "endings" } | { kind: "gloss_en_to_lemma" }>,
  index: number,
): LessonCard {
  if (draft.kind === "endings") {
    return {
      index,
      kind: "endings",
      prompt: draft.prompt,
      options: draft.options,
      correctIndex: draft.correctIndex,
      xp: draft.xp,
      explainer: draft.explainer,
      endingsQuestId: draft.questId,
    }
  }
  return {
    index,
    kind: "gloss_en_to_lemma",
    prompt: draft.prompt,
    hint: draft.hint,
    options: draft.options,
    correctIndex: draft.correctIndex,
    xp: draft.xp,
    explainer: draft.explainer,
  }
}

/** Expand drafts into playable cards (fetches morph for morph drafts). */
export async function finalizeLessonDrafts(drafts: LessonDraft[], seed: number): Promise<LessonCard[]> {
  const rng = mulberry32(seed ^ 0x9e3779b9)
  const out: LessonCard[] = []
  let i = 0
  for (const d of drafts) {
    if (d.kind === "morph") {
      const card = await morphDraftToCard(d, rng)
      out.push({ ...card, index: i })
    } else {
      out.push(draftToStaticCard(d, i))
    }
    i += 1
  }
  return out
}
