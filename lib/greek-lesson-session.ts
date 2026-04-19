/**
 * Duolingo-style Greek lesson: deterministic draft builder + async morph hydration.
 */

import {
  buildChallengeForTarget,
  pickQuestTargetsInPhrase,
  wordFormKey,
} from "@/app/devotions/greek/greek-verse-quest-logic"
import type { QuestWordChallenge } from "@/app/devotions/greek/greek-verse-quest-logic"
import { GREEK_LEMMA_ENGLISH_QUIZ } from "@/lib/bible/greek-lemma-english-gloss.generated"
import { englishGlossForLemma, normalizeGreekLemma } from "@/lib/bible/greek-lemma-english-quiz"
import { MORPH_PILOT_CHAPTERS, morphPilotPassageRef } from "@/lib/bible/morph-pilot-menu"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { ENDINGS_QUESTS, type EndingsQuestGroup } from "@/lib/greek-endings-quest-data"
import { GREEK_LESSON_ROOTS } from "@/lib/greek-lesson-roots-data"

export const LESSON_ENDINGS_COUNT = 4
export const LESSON_GLOSS_EN_COUNT = 3
export const LESSON_GLOSS_LEMMA_EN_COUNT = 3
export const LESSON_MORPH_COUNT = 4
/** Combining forms & stems — piece longer words together instead of brute-memorizing glosses. */
export const LESSON_ROOTS_COUNT = 4

/** @deprecated use LESSON_TOTAL_CARDS */
export const DEFAULT_LESSON_CARD_COUNT =
  LESSON_ENDINGS_COUNT +
  LESSON_GLOSS_EN_COUNT +
  LESSON_GLOSS_LEMMA_EN_COUNT +
  LESSON_MORPH_COUNT +
  LESSON_ROOTS_COUNT

export const LESSON_TOTAL_CARDS = DEFAULT_LESSON_CARD_COUNT

const CHALLENGE_KIND_LABEL: Record<QuestWordChallenge["kind"], string> = {
  lemma: "lemma → English",
  "part-of-speech": "part of speech",
  case: "case",
  number: "number",
  gender: "gender",
  tense: "tense",
  voice: "voice",
  mood: "mood",
}

export function endingsTopicLabel(group: EndingsQuestGroup): string {
  switch (group) {
    case "verb":
      return "Verb endings"
    case "noun":
      return "Noun endings"
    case "article":
      return "Article forms"
  }
}

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

export type BuildLessonOpts = {
  /** Normalized Greek lemmas (e.g. from word bank) weighted in vocabulary picks */
  weakLemmas?: string[]
}

export type LessonDraft =
  | {
      kind: "endings"
      questId: string
      topic: string
      prompt: string
      options: string[]
      correctIndex: number
      xp: number
      explainer: string
    }
  | {
      kind: "gloss_en_to_lemma"
      topic: string
      prompt: string
      hint: string
      options: string[]
      correctIndex: number
      xp: number
      explainer: string
      /** Ties lesson vocab to word bank / weak-word loop (`lemma|lesson-vocab`). */
      wordMemoryKey: string
    }
  | {
      kind: "gloss_lemma_to_en"
      topic: string
      prompt: string
      hint: string
      options: string[]
      correctIndex: number
      xp: number
      explainer: string
      wordMemoryKey: string
    }
  | {
      kind: "morph"
      passageRef: string
      xp: number
    }
  | {
      kind: "root"
      rootId: string
      topic: string
      prompt: string
      hint: string
      options: string[]
      correctIndex: number
      xp: number
      explainer: string
    }

export type LessonCardKind = "endings" | "gloss_en_to_lemma" | "gloss_lemma_to_en" | "morph" | "root"

export type LessonCard = {
  index: number
  kind: LessonCardKind
  /** Short label for the chip (e.g. "Verb endings", "John 1:1") */
  topic: string
  prompt: string
  /** Secondary line (gloss text, Greek lemma, or surface form for morph) */
  hint?: string
  options: string[]
  correctIndex: number
  xp: number
  explainer: string
  endingsQuestId?: string
  passageRef?: string
  /** Morph quiz dimension (lemma, case, …) for richer feedback */
  morphQuizKind?: QuestWordChallenge["kind"]
  /** When set, lesson outcome updates spaced-repetition stats (same store as Verse Quest). */
  wordMemoryKey?: string
}

const LESSON_VOCAB_MEMORY_PARSE = "lesson-vocab"

export function lessonVocabMemoryKey(lemma: string): string {
  return `${normalizeGreekLemma(lemma)}|${LESSON_VOCAB_MEMORY_PARSE}`
}

function weakLemmaSet(weakLemmas: string[] | undefined): Set<string> {
  const s = new Set<string>()
  if (!weakLemmas?.length) return s
  for (const l of weakLemmas) {
    const n = normalizeGreekLemma(l)
    if (n) s.add(n)
  }
  return s
}

function pickLemmaIndexWithWeakBias(rng: () => number, lemmas: string[], weak: Set<string>): number {
  if (weak.size === 0) return Math.floor(rng() * lemmas.length)
  const weakIndices: number[] = []
  for (let i = 0; i < lemmas.length; i++) {
    if (weak.has(normalizeGreekLemma(lemmas[i]!))) weakIndices.push(i)
  }
  if (weakIndices.length === 0 || rng() > 0.48) return Math.floor(rng() * lemmas.length)
  return weakIndices[Math.floor(rng() * weakIndices.length)]!
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
    topic: endingsTopicLabel(q.group),
    prompt: q.prompt,
    options,
    correctIndex,
    xp: q.xp,
    explainer: q.explainer,
  }
}

function glossEnToLemmaDraft(
  rng: () => number,
  weak: Set<string>,
): Extract<LessonDraft, { kind: "gloss_en_to_lemma" }> {
  const lemmas = Object.keys(GREEK_LEMMA_ENGLISH_QUIZ).filter((l) => englishGlossForLemma(l))
  if (lemmas.length < 6) {
    return {
      kind: "gloss_en_to_lemma",
      topic: "English → Greek",
      prompt: "Which Greek word matches the gloss “word”?",
      hint: "word",
      options: ["λόγος", "ἀγάπη", "πίστις", "ζωή"],
      correctIndex: 0,
      xp: 8,
      explainer: "λόγος → word",
      wordMemoryKey: lessonVocabMemoryKey("λόγος"),
    }
  }
  const pickIdx = pickLemmaIndexWithWeakBias(rng, lemmas, weak)
  const correct = lemmas[pickIdx]!
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
    topic: weak.has(correctLemma) ? "English → Greek · review" : "English → Greek",
    prompt: `The English gloss is “${gloss}”. Which Greek word matches?`,
    hint: gloss,
    options,
    correctIndex,
    xp: 8,
    explainer: `${correctLemma} commonly glosses as “${gloss}”.`,
    wordMemoryKey: lessonVocabMemoryKey(correctLemma),
  }
}

const ROOT_MEANING_FALLBACKS = [
  "authority",
  "time",
  "place",
  "people",
  "covenant",
  "spirit",
  "truth",
  "peace",
]

function rootDraftFromPool(rng: () => number): Extract<LessonDraft, { kind: "root" }> {
  const pool = [...GREEK_LESSON_ROOTS]
  if (pool.length < 8) {
    const r = GREEK_LESSON_ROOTS[0]!
    return {
      kind: "root",
      rootId: r.id,
      topic: "Greek roots",
      prompt: `What idea does “${r.form}” usually carry?`,
      hint: r.form,
      options: [r.meaning, "three", "God", "write"],
      correctIndex: 0,
      xp: 7,
      explainer: `“${r.form}” → ${r.meaning}.`,
    }
  }
  shuffleInPlace(pool, rng)
  const correct = pool[0]!
  const usedMeanings = new Set<string>([correct.meaning])
  const distractorMeanings: string[] = []
  for (const r of pool.slice(1)) {
    if (distractorMeanings.length >= 3) break
    if (!usedMeanings.has(r.meaning)) {
      usedMeanings.add(r.meaning)
      distractorMeanings.push(r.meaning)
    }
  }
  for (const f of ROOT_MEANING_FALLBACKS) {
    if (distractorMeanings.length >= 3) break
    if (!usedMeanings.has(f)) {
      usedMeanings.add(f)
      distractorMeanings.push(f)
    }
  }
  while (distractorMeanings.length < 3) {
    distractorMeanings.push(`idea ${distractorMeanings.length + 1}`)
  }
  const options = [correct.meaning, ...distractorMeanings.slice(0, 3)]
  shuffleInPlace(options, rng)
  const correctIndex = options.indexOf(correct.meaning)

  const exampleGreek = correct.exampleGreek?.trim() ?? ""
  const hasExampleGreek = exampleGreek.length > 0
  const prompt = hasExampleGreek
    ? `The element “${correct.form}” shows up in words like ${exampleGreek}. What core idea does this root carry?`
    : `The building block “${correct.form}” appears in many biblical Greek words. What is its usual sense?`

  let explainer = `“${correct.form}” → ${correct.meaning}.`
  if (hasExampleGreek) {
    explainer += correct.exampleGloss
      ? ` Example: ${exampleGreek} is often rendered ‘${correct.exampleGloss}’ in English.`
      : ` Example word: ${exampleGreek}.`
  }
  if (correct.note) explainer += ` ${correct.note}`

  return {
    kind: "root",
    rootId: correct.id,
    topic: "Greek roots",
    prompt,
    hint: correct.form,
    options,
    correctIndex,
    xp: 7,
    explainer: explainer.trim(),
  }
}

function glossLemmaToEnDraft(
  rng: () => number,
  weak: Set<string>,
): Extract<LessonDraft, { kind: "gloss_lemma_to_en" }> {
  const lemmas = Object.keys(GREEK_LEMMA_ENGLISH_QUIZ).filter((l) => englishGlossForLemma(l))
  if (lemmas.length < 6) {
    return {
      kind: "gloss_lemma_to_en",
      topic: "Greek → English",
      prompt: "What English gloss fits this Greek word?",
      hint: "λόγος",
      options: ["word", "love", "faith", "life"],
      correctIndex: 0,
      xp: 8,
      explainer: "λόγος → word",
      wordMemoryKey: lessonVocabMemoryKey("λόγος"),
    }
  }
  const pickIdx = pickLemmaIndexWithWeakBias(rng, lemmas, weak)
  const correctLemmaRaw = lemmas[pickIdx]!
  const correctLemma = normalizeGreekLemma(correctLemmaRaw)
  const correctGloss = englishGlossForLemma(correctLemmaRaw)!

  const glossByLemma = lemmas.map((l) => ({
    lemma: l,
    gloss: englishGlossForLemma(l)!,
  }))
  const otherGlosses = glossByLemma
    .filter((x) => x.gloss !== correctGloss)
    .map((x) => x.gloss)
  const uniqueWrong: string[] = []
  const seenG = new Set<string>()
  shuffleInPlace(otherGlosses, rng)
  for (const g of otherGlosses) {
    if (seenG.has(g)) continue
    seenG.add(g)
    uniqueWrong.push(g)
    if (uniqueWrong.length >= 3) break
  }
  const fallbackGlosses = ["God", "man", "spirit", "son", "day", "house", "people", "world"]
  for (const g of fallbackGlosses) {
    if (uniqueWrong.length >= 3) break
    if (g === correctGloss || seenG.has(g)) continue
    seenG.add(g)
    uniqueWrong.push(g)
  }
  const options = [correctGloss, ...uniqueWrong.slice(0, 3)]
  shuffleInPlace(options, rng)
  const correctIndex = options.indexOf(correctGloss)

  return {
    kind: "gloss_lemma_to_en",
    topic: weak.has(correctLemma) ? "Greek → English · review" : "Greek → English",
    prompt: "What English gloss best fits this Greek word?",
    hint: correctLemma,
    options,
    correctIndex,
    xp: 8,
    explainer: `“${correctLemma}” is often glossed “${correctGloss}”.`,
    wordMemoryKey: lessonVocabMemoryKey(correctLemma),
  }
}

function morphRefsForRun(rng: () => number, count: number): string[] {
  const refs: string[] = []
  for (let i = 0; i < count; i++) {
    const chapterIdx = Math.floor(rng() * MORPH_PILOT_CHAPTERS.length)
    const ch = MORPH_PILOT_CHAPTERS[chapterIdx]!
    const verse = 1 + Math.floor(rng() * Math.max(1, ch.maxVerse))
    refs.push(morphPilotPassageRef(ch, verse))
  }
  return refs
}

/** Deterministic lesson draft list (morph entries need `finalizeLessonDrafts`). */
export function buildLessonDrafts(seed: number, opts?: BuildLessonOpts): { runId: string; drafts: LessonDraft[] } {
  const rng = mulberry32(seed)
  const runId = seed.toString(36)
  const weak = weakLemmaSet(opts?.weakLemmas)

  const endingsPool = [...ENDINGS_QUESTS]
  shuffleInPlace(endingsPool, rng)
  const endingsPicks = endingsPool.slice(0, Math.min(LESSON_ENDINGS_COUNT, endingsPool.length))

  const drafts: LessonDraft[] = []
  for (const q of endingsPicks) {
    drafts.push(endingsDraftFromQuest(q, rng))
  }
  for (let g = 0; g < LESSON_GLOSS_EN_COUNT; g++) {
    drafts.push(glossEnToLemmaDraft(rng, weak))
  }
  for (let g = 0; g < LESSON_GLOSS_LEMMA_EN_COUNT; g++) {
    drafts.push(glossLemmaToEnDraft(rng, weak))
  }
  for (const ref of morphRefsForRun(rng, LESSON_MORPH_COUNT)) {
    drafts.push({ kind: "morph", passageRef: ref, xp: 8 })
  }
  for (let r = 0; r < LESSON_ROOTS_COUNT; r++) {
    drafts.push(rootDraftFromPool(rng))
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

function morphExplainer(token: GreekMorphToken, challengeKind: QuestWordChallenge["kind"], ref: string): string {
  const lemma = token.lemma ? `${normalizeGreekLemma(token.lemma)} · ` : ""
  const dim = CHALLENGE_KIND_LABEL[challengeKind]
  return `${lemma}${ref} — ${dim}.`
}

async function morphDraftToCard(draft: Extract<LessonDraft, { kind: "morph" }>, rng: () => number): Promise<LessonCard> {
  const verse = verseFromPassageRef(draft.passageRef)
  let tokens = await fetchMorphTokensForRef(draft.passageRef, verse)
  let pick = pickQuestTargetsInPhrase(tokens, new Set(), {}, false)
  let ref = draft.passageRef

  if (pick.targetIndexes.length === 0) {
    for (let attempt = 0; attempt < 6 && pick.targetIndexes.length === 0; attempt++) {
      const chapterIdx = Math.floor(rng() * MORPH_PILOT_CHAPTERS.length)
      const ch = MORPH_PILOT_CHAPTERS[chapterIdx]!
      const v = 1 + Math.floor(rng() * Math.max(1, ch.maxVerse))
      ref = morphPilotPassageRef(ch, v)
      tokens = await fetchMorphTokensForRef(ref, v)
      pick = pickQuestTargetsInPhrase(tokens, new Set(), {}, false)
    }
  }

  if (pick.targetIndexes.length === 0) {
    const g = glossEnToLemmaDraft(rng, new Set())
    return {
      index: 0,
      kind: "gloss_en_to_lemma",
      topic: g.topic,
      prompt: g.prompt,
      hint: g.hint,
      options: g.options,
      correctIndex: g.correctIndex,
      xp: draft.xp,
      explainer: `${g.explainer} (extra vocab card — no pilot tokens for the first verse tried.)`,
      wordMemoryKey: g.wordMemoryKey,
    }
  }

  const ti = pick.targetIndexes[Math.floor(rng() * pick.targetIndexes.length)]!
  const ch = buildChallengeForTarget(tokens, ti)
  if (!ch) {
    const g = glossEnToLemmaDraft(rng, new Set())
    return {
      index: 0,
      kind: "gloss_en_to_lemma",
      topic: g.topic,
      prompt: g.prompt,
      hint: g.hint,
      options: g.options,
      correctIndex: g.correctIndex,
      xp: draft.xp,
      explainer: g.explainer,
      wordMemoryKey: g.wordMemoryKey,
    }
  }

  const surface = tokens[ti]?.word ?? ""
  const token = tokens[ti]!
  const memKey = token.lemma && token.parse ? wordFormKey(token) : undefined
  return {
    index: 0,
    kind: "morph",
    topic: `Verse · ${ref}`,
    prompt: ch.prompt,
    hint: surface ? `“${surface}”` : undefined,
    options: ch.options,
    correctIndex: ch.correctOptionIndex,
    xp: draft.xp,
    explainer: morphExplainer(token, ch.kind, ref),
    passageRef: ref,
    morphQuizKind: ch.kind,
    wordMemoryKey: memKey,
  }
}

function draftToStaticCard(
  draft: Exclude<LessonDraft, { kind: "morph" }>,
  index: number,
): LessonCard {
  if (draft.kind === "endings") {
    return {
      index,
      kind: "endings",
      topic: draft.topic,
      prompt: draft.prompt,
      options: draft.options,
      correctIndex: draft.correctIndex,
      xp: draft.xp,
      explainer: draft.explainer,
      endingsQuestId: draft.questId,
    }
  }
  if (draft.kind === "gloss_en_to_lemma") {
    return {
      index,
      kind: "gloss_en_to_lemma",
      topic: draft.topic,
      prompt: draft.prompt,
      hint: draft.hint,
      options: draft.options,
      correctIndex: draft.correctIndex,
      xp: draft.xp,
      explainer: draft.explainer,
      wordMemoryKey: draft.wordMemoryKey,
    }
  }
  if (draft.kind === "root") {
    return {
      index,
      kind: "root",
      topic: draft.topic,
      prompt: draft.prompt,
      hint: draft.hint,
      options: draft.options,
      correctIndex: draft.correctIndex,
      xp: draft.xp,
      explainer: draft.explainer,
    }
  }
  return {
    index,
    kind: "gloss_lemma_to_en",
    topic: draft.topic,
    prompt: draft.prompt,
    hint: draft.hint,
    options: draft.options,
    correctIndex: draft.correctIndex,
    xp: draft.xp,
    explainer: draft.explainer,
    wordMemoryKey: draft.wordMemoryKey,
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
