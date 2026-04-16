/**
 * Pure quest logic, types, and helpers for Verse Quest (extracted from the main client).
 */

import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { MORPH_PILOT_CHAPTERS } from "@/lib/bible/morph-pilot-menu"
import { buildLemmaQuizLabelMap, normalizeGreekLemma } from "@/lib/bible/greek-lemma-english-quiz"
import type { GreekWordMemory } from "@/lib/devotions-greek-word-memory"

export const WORD_XP = 12
export const LEVEL_COMPLETE_XP = 24
export const PERFECT_LEVEL_BONUS_XP = 10
export const QUEST_MIN_TARGETS = 3
export const QUEST_MAX_TARGETS = 5
export const DAILY_VERSE_RUN_KEY = "daily-verse-run"
export const DAILY_VERSE_RUN_STATE_KEY = "fx_devotions_greek_v1_daily_run_state"

export type QuestWordStage = "challenge" | "revealed"
export type QuestWordChallenge = {
  targetIndex: number
  kind: "lemma" | "part-of-speech" | "case" | "number" | "gender" | "tense" | "voice" | "mood"
  prompt: string
  options: string[]
  correctOptionIndex: number
}
export type LevelCompleteState = {
  levelKey: string
  xpGained: number
  correctWords: number
  learnedWords: number
  encouragement: string
}

export type QuestQuizFeedback =
  | { outcome: "correct"; xpGained: number; prompt: string }
  | { outcome: "incorrect"; correctAnswer: string; chosenAnswer?: string; prompt: string }
  | { outcome: "skipped"; correctAnswer: string; prompt: string }

export type DailyVerseRunState = {
  date: string
  levelKey: string
  completed: boolean
}

export type DailyVerseAssignment = {
  pilotIdx: number
  verse: number
  levelKey: string
  label: string
}

export const POS_LABELS: Record<string, string> = {
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

export const CASE_LABELS: Record<string, string> = {
  N: "Nominative",
  G: "Genitive",
  D: "Dative",
  A: "Accusative",
  V: "Vocative",
}

export const NUMBER_LABELS: Record<string, string> = {
  S: "Singular",
  P: "Plural",
}

export const GENDER_LABELS: Record<string, string> = {
  M: "Masculine",
  F: "Feminine",
  N: "Neuter",
}

export const TENSE_LABELS: Record<string, string> = {
  P: "Present",
  I: "Imperfect",
  F: "Future",
  A: "Aorist",
  X: "Perfect",
  Y: "Pluperfect",
  T: "Future Perfect",
}

export const VOICE_LABELS: Record<string, string> = {
  A: "Active",
  M: "Middle",
  P: "Passive",
}

export const MOOD_LABELS: Record<string, string> = {
  I: "Indicative",
  D: "Imperative",
  S: "Subjunctive",
  O: "Optative",
  N: "Infinitive",
  P: "Participle",
}

export function vibrateQuest(kind: "correct" | "incorrect" | "skipped") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return
  try {
    if (kind === "correct") navigator.vibrate([12, 65, 14])
    else if (kind === "incorrect") navigator.vibrate([32, 55, 48])
    else navigator.vibrate(14)
  } catch {
    /* ignore */
  }
}

export function todayDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function dayNumberFromDateKey(dateKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return Math.floor(Date.now() / 86400000)
  const y = Number.parseInt(match[1], 10)
  const m = Number.parseInt(match[2], 10)
  const d = Number.parseInt(match[3], 10)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return Math.floor(Date.now() / 86400000)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

function normalizeModulo(value: number, mod: number): number {
  if (mod <= 0) return 0
  const rem = value % mod
  return rem < 0 ? rem + mod : rem
}

export function buildDailyVerseAssignment(dateKey: string): DailyVerseAssignment {
  if (MORPH_PILOT_CHAPTERS.length === 0) {
    return {
      pilotIdx: 0,
      verse: 1,
      levelKey: "john-1-1",
      label: "John 1",
    }
  }
  const totalVerses = MORPH_PILOT_CHAPTERS.reduce((sum, item) => sum + Math.max(1, item.maxVerse), 0)
  const dayIndex = normalizeModulo(dayNumberFromDateKey(dateKey), Math.max(1, totalVerses))
  let cursor = dayIndex
  for (let i = 0; i < MORPH_PILOT_CHAPTERS.length; i++) {
    const chapter = MORPH_PILOT_CHAPTERS[i]
    if (cursor < chapter.maxVerse) {
      const verse = cursor + 1
      return {
        pilotIdx: i,
        verse,
        levelKey: `${chapter.bookSlug}-${chapter.chapter}-${verse}`,
        label: chapter.label,
      }
    }
    cursor -= chapter.maxVerse
  }
  const fallback = MORPH_PILOT_CHAPTERS[0]
  return {
    pilotIdx: 0,
    verse: 1,
    levelKey: `${fallback.bookSlug}-${fallback.chapter}-1`,
    label: fallback.label,
  }
}

export function parseDailyVerseRunState(raw: string | null): DailyVerseRunState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<DailyVerseRunState>
    if (
      typeof parsed.date !== "string" ||
      typeof parsed.levelKey !== "string" ||
      typeof parsed.completed !== "boolean"
    ) {
      return null
    }
    return {
      date: parsed.date,
      levelKey: parsed.levelKey,
      completed: parsed.completed,
    }
  } catch {
    return null
  }
}

export function getDailyVerseRunState(): DailyVerseRunState | null {
  if (typeof window === "undefined") return null
  return parseDailyVerseRunState(window.localStorage.getItem(DAILY_VERSE_RUN_STATE_KEY))
}

export function saveDailyVerseRunState(state: DailyVerseRunState): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DAILY_VERSE_RUN_STATE_KEY, JSON.stringify(state))
}

export function wordFormKey(token: GreekMorphToken): string {
  return `${token.lemma}|${token.parse}`
}

function normalizeParseTemplate(parse: string): string {
  const raw = (parse || "").trim()
  if (raw.length >= 8) return raw.slice(0, 8)
  return raw.padEnd(8, "-")
}

function stableHash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

export type QuestPhrasePick = {
  targetIndexes: number[]
  clusterStart: number
  clusterEnd: number
}

function scoreTokenForQuest(
  token: GreekMorphToken,
  memory: GreekWordMemory,
  weakSet: Set<string>,
  reviewMode: boolean,
): number {
  const key = wordFormKey(token)
  const mem = memory[key]
  const isWeak = weakSet.has(key)
  const familiarity = mem?.familiarity ?? "new"
  const familiarityScore = familiarity === "new" ? 3 : familiarity === "seen" ? 2 : -2
  const contentScore = /^(V|N|A|R|D)/.test(token.pos) ? 3 : 1
  const reviewBoost = reviewMode ? (isWeak ? 8 : familiarity === "seen" ? 4 : -3) : 0
  return (isWeak ? 6 : 0) + familiarityScore + contentScore + reviewBoost
}

export function pickQuestTargetsInPhrase(
  tokens: GreekMorphToken[],
  weakSet: Set<string>,
  memory: GreekWordMemory,
  reviewMode: boolean,
): QuestPhrasePick {
  const n = tokens.length
  if (n === 0) return { targetIndexes: [], clusterStart: 0, clusterEnd: 0 }

  const targetCount = Math.min(
    n,
    Math.max(QUEST_MIN_TARGETS, Math.min(QUEST_MAX_TARGETS, Math.ceil(n * 0.34))),
  )

  const perIndex = tokens.map((token, idx) => ({
    idx,
    score: scoreTokenForQuest(token, memory, weakSet, reviewMode),
  }))

  if (n === 1) {
    return { targetIndexes: [0], clusterStart: 0, clusterEnd: 0 }
  }

  const minPhraseLen = Math.min(n, Math.max(targetCount + 1, 3))
  const maxPhraseLen = Math.min(n, 12)

  let bestStart = 0
  let bestEnd = n - 1
  let bestScore = -Infinity

  for (let len = maxPhraseLen; len >= minPhraseLen; len--) {
    for (let start = 0; start + len <= n; start++) {
      const end = start + len - 1
      let sum = 0
      let verbHits = 0
      for (let i = start; i <= end; i++) {
        sum += perIndex[i].score
        if (tokens[i].pos.startsWith("V")) verbHits += 1
      }
      const combined = sum + Math.min(4, verbHits) * 0.5
      if (combined > bestScore) {
        bestScore = combined
        bestStart = start
        bestEnd = end
      }
    }
  }

  const windowCandidates = perIndex.filter((p) => p.idx >= bestStart && p.idx <= bestEnd)
  windowCandidates.sort((a, b) => b.score - a.score)
  const take = Math.min(targetCount, windowCandidates.length)
  const picked = windowCandidates
    .slice(0, take)
    .map((p) => p.idx)
    .sort((a, b) => a - b)

  return {
    targetIndexes: picked,
    clusterStart: bestStart,
    clusterEnd: bestEnd,
  }
}

function buildChallengeOptions(correct: string, pool: string[], seed: number): string[] {
  const uniquePool = Array.from(new Set(pool.filter((item) => item && item !== correct))).sort((a, b) =>
    a.localeCompare(b),
  )
  const limit = Math.min(3, uniquePool.length)
  const start = uniquePool.length > 0 ? seed % uniquePool.length : 0
  const distractors: string[] = []
  for (let i = 0; i < limit; i++) {
    distractors.push(uniquePool[(start + i) % uniquePool.length])
  }
  const options = Array.from(new Set([correct, ...distractors]))
  const rotateBy = options.length > 0 ? seed % options.length : 0
  const rotated = options.slice(rotateBy).concat(options.slice(0, rotateBy))
  return rotated
}

export function buildChallengeForTarget(tokens: GreekMorphToken[], targetIndex: number): QuestWordChallenge | null {
  const target = tokens[targetIndex]
  if (!target) return null
  const parseTemplate = normalizeParseTemplate(target.parse)
  const posKey = (target.pos || "").trim().charAt(0)
  const posLabel = POS_LABELS[posKey]
  const caseCode = parseTemplate[4]
  const numberCode = parseTemplate[5]
  const genderCode = parseTemplate[6]
  const tenseCode = parseTemplate[1]
  const voiceCode = parseTemplate[2]
  const moodCode = parseTemplate[3]

  const seed = stableHash(`${target.word}|${target.lemma}|${target.parse}|${targetIndex}`)
  const challengeKinds: QuestWordChallenge["kind"][] = []

  if (target.lemma) challengeKinds.push("lemma")
  if (posLabel) challengeKinds.push("part-of-speech")
  if (CASE_LABELS[caseCode]) challengeKinds.push("case")
  if (NUMBER_LABELS[numberCode]) challengeKinds.push("number")
  if (GENDER_LABELS[genderCode]) challengeKinds.push("gender")
  if (target.pos.startsWith("V")) {
    if (TENSE_LABELS[tenseCode]) challengeKinds.push("tense")
    if (VOICE_LABELS[voiceCode]) challengeKinds.push("voice")
    if (MOOD_LABELS[moodCode]) challengeKinds.push("mood")
  }
  if (challengeKinds.length === 0) return null

  const kind = challengeKinds[seed % challengeKinds.length]

  const lemmaPool = Array.from(new Set(tokens.map((t) => t.lemma).filter(Boolean)))
  const posPool = Array.from(
    new Set(
      tokens
        .map((t) => POS_LABELS[(t.pos || "").trim().charAt(0)])
        .filter((label): label is string => Boolean(label)),
    ),
  )

  let correct = ""
  let prompt = ""
  let pool: string[] = []

  switch (kind) {
    case "lemma": {
      const lemmaNorm = normalizeGreekLemma(target.lemma)
      const labelByLemma = buildLemmaQuizLabelMap(lemmaPool)
      correct = labelByLemma.get(lemmaNorm) ?? ""
      pool = lemmaPool
        .map((l) => labelByLemma.get(normalizeGreekLemma(l)))
        .filter((label): label is string => Boolean(label))
      prompt = "Which English meaning matches this word's lemma?"
      break
    }
    case "part-of-speech":
      correct = posLabel
      prompt = "What part of speech is this form?"
      pool = posPool.length >= 2 ? posPool : Object.values(POS_LABELS)
      break
    case "case":
      correct = CASE_LABELS[caseCode]
      prompt = "Which case does this form use?"
      pool = Object.values(CASE_LABELS)
      break
    case "number":
      correct = NUMBER_LABELS[numberCode]
      prompt = "Is this form singular or plural?"
      pool = Object.values(NUMBER_LABELS)
      break
    case "gender":
      correct = GENDER_LABELS[genderCode]
      prompt = "What gender is this form?"
      pool = Object.values(GENDER_LABELS)
      break
    case "tense":
      correct = TENSE_LABELS[tenseCode]
      prompt = "Which tense best matches this verb form?"
      pool = Object.values(TENSE_LABELS)
      break
    case "voice":
      correct = VOICE_LABELS[voiceCode]
      prompt = "What voice is this verb form?"
      pool = Object.values(VOICE_LABELS)
      break
    case "mood":
      correct = MOOD_LABELS[moodCode]
      prompt = "Which mood best matches this verb form?"
      pool = Object.values(MOOD_LABELS)
      break
    default:
      return null
  }

  if (!correct) return null
  const options = buildChallengeOptions(correct, pool, seed)
  if (options.length < 2) return null
  const correctOptionIndex = options.findIndex((x) => x === correct)
  if (correctOptionIndex < 0) return null

  return { targetIndex, kind, prompt, options, correctOptionIndex }
}
