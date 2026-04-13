"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Flame,
  Lightbulb,
  Menu,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { MorphologySidebarPanel } from "@/app/bible/_components/morphology-sidebar"
import { getMorphHintAbbrev } from "@/lib/bible/greek-morph-hints"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { buildGreekWordLearningClues } from "@/lib/bible/greek-word-learning-clues"
import {
  getGreekProgressSnapshot,
  getGreekStudyProgress,
  recordGreekStudyEvent,
  type GreekProgressSnapshot,
} from "@/lib/devotions-greek-progress"
import {
  buildWeakWordSet,
  getGreekWordMemory,
  getWordFamiliarityLabel,
  recordGreekWordMemoryTap,
  type GreekWordFamiliarity,
  type GreekWordMemory,
} from "@/lib/devotions-greek-word-memory"
import { MORPH_PILOT_CHAPTERS } from "@/lib/bible/morph-pilot-menu"

import {
  DETAIL_SWIPE_CLOSE_THRESHOLD,
  DETAIL_SWIPE_CLOSE_VELOCITY,
  MENU_SWIPE_CLOSE_THRESHOLD,
  useGreekPilotVerse,
  VERSE_SWIPE_HORIZONTAL_RATIO,
  VERSE_SWIPE_MIN_X,
} from "@/app/devotions/greek/greek-pilot-verse-shared"

const WORD_XP = 12
const COACH_XP = 20
const LEVEL_COMPLETE_XP = 24
const PERFECT_LEVEL_BONUS_XP = 10
const QUEST_MIN_TARGETS = 3
const QUEST_MAX_TARGETS = 5
const DAILY_VERSE_RUN_KEY = "daily-verse-run"
const DAILY_VERSE_RUN_STATE_KEY = "fx_devotions_greek_v1_daily_run_state"
const COACH_HISTORY_LIMIT = 6

type QuestWordStage = "challenge" | "revealed"
type QuestWordChallenge = {
  targetIndex: number
  kind: "lemma" | "part-of-speech" | "case" | "number" | "gender" | "tense" | "voice" | "mood"
  prompt: string
  options: string[]
  correctOptionIndex: number
}
type LevelCompleteState = {
  levelKey: string
  xpGained: number
  correctWords: number
  learnedWords: number
  encouragement: string
}
type DailyVerseRunState = {
  date: string
  levelKey: string
  completed: boolean
}
type DailyVerseAssignment = {
  pilotIdx: number
  verse: number
  levelKey: string
  label: string
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

const CASE_LABELS: Record<string, string> = {
  N: "Nominative",
  G: "Genitive",
  D: "Dative",
  A: "Accusative",
  V: "Vocative",
}

const NUMBER_LABELS: Record<string, string> = {
  S: "Singular",
  P: "Plural",
}

const GENDER_LABELS: Record<string, string> = {
  M: "Masculine",
  F: "Feminine",
  N: "Neuter",
}

const TENSE_LABELS: Record<string, string> = {
  P: "Present",
  I: "Imperfect",
  F: "Future",
  A: "Aorist",
  X: "Perfect",
  Y: "Pluperfect",
  T: "Future Perfect",
}

const VOICE_LABELS: Record<string, string> = {
  A: "Active",
  M: "Middle",
  P: "Passive",
}

const MOOD_LABELS: Record<string, string> = {
  I: "Indicative",
  D: "Imperative",
  S: "Subjunctive",
  O: "Optative",
  N: "Infinitive",
  P: "Participle",
}

function todayDateKey(date = new Date()): string {
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

function buildDailyVerseAssignment(dateKey: string): DailyVerseAssignment {
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

function parseDailyVerseRunState(raw: string | null): DailyVerseRunState | null {
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

function getDailyVerseRunState(): DailyVerseRunState | null {
  if (typeof window === "undefined") return null
  return parseDailyVerseRunState(window.localStorage.getItem(DAILY_VERSE_RUN_STATE_KEY))
}

function saveDailyVerseRunState(state: DailyVerseRunState): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DAILY_VERSE_RUN_STATE_KEY, JSON.stringify(state))
}

function wordFormKey(token: GreekMorphToken): string {
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

function pickQuestTargetIndexes(
  tokens: GreekMorphToken[],
  weakSet: Set<string>,
  memory: GreekWordMemory,
  reviewMode: boolean,
): number[] {
  if (tokens.length === 0) return []
  const scored = tokens.map((token, idx) => {
    const key = wordFormKey(token)
    const mem = memory[key]
    const isWeak = weakSet.has(key)
    const familiarity = mem?.familiarity ?? "new"
    const familiarityScore = familiarity === "new" ? 3 : familiarity === "seen" ? 2 : -2
    const contentScore = /^(V|N|A|R|D)/.test(token.pos) ? 3 : 1
    const reviewBoost = reviewMode ? (isWeak ? 8 : familiarity === "seen" ? 4 : -3) : 0
    const score = (isWeak ? 6 : 0) + familiarityScore + contentScore + reviewBoost
    return { idx, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const targetCount = Math.min(
    tokens.length,
    Math.max(QUEST_MIN_TARGETS, Math.min(QUEST_MAX_TARGETS, Math.ceil(tokens.length * 0.34))),
  )
  return scored.slice(0, targetCount).map((item) => item.idx)
}

function buildChallengeForTarget(tokens: GreekMorphToken[], targetIndex: number): QuestWordChallenge | null {
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
    case "lemma":
      correct = target.lemma
      prompt = "Which lemma matches this word form?"
      pool = lemmaPool
      break
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

export function GreekVerseQuestClient() {
  const {
    pilot,
    passageRef,
    readerUrl,
    hydrated,
    loading,
    error,
    english,
    greekTokens,
    verse,
    prevVerse,
    nextVerse,
    rolodexBookSlug,
    setRolodexBookSlug,
    rolodexChapter,
    setRolodexChapter,
    rolodexVerse,
    setRolodexVerse,
    rolodexBooks,
    rolodexChapters,
    selectedRolodexChapter,
    rolodexVerseOptions,
    applyRolodexSelection,
  } = useGreekPilotVerse()

  const [menuOpen, setMenuOpen] = useState(false)
  const [wordHintsEnabled, setWordHintsEnabled] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null)
  const [wordMemory, setWordMemory] = useState<GreekWordMemory>(() => getGreekWordMemory())
  const [reviewMode, setReviewMode] = useState(false)
  const [questStage, setQuestStage] = useState<QuestWordStage>("challenge")
  const [questChallenge, setQuestChallenge] = useState<QuestWordChallenge | null>(null)
  const [questTargetIndexes, setQuestTargetIndexes] = useState<number[]>([])
  const [completedTargetIndexes, setCompletedTargetIndexes] = useState<number[]>([])
  const [correctTargetIndexes, setCorrectTargetIndexes] = useState<number[]>([])
  const [dailyVerseRunDone, setDailyVerseRunDone] = useState(false)
  const [levelComplete, setLevelComplete] = useState<LevelCompleteState | null>(null)
  const [microWinBurst, setMicroWinBurst] = useState<string | null>(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [coachPayload, setCoachPayload] = useState<GreekCoachPayload | null>(null)
  const [coachTokenKey, setCoachTokenKey] = useState<string | null>(null)
  const [coachQuestion, setCoachQuestion] = useState("")
  const [coachHistory, setCoachHistory] = useState<CoachHistoryItem[]>([])
  const [coachCopied, setCoachCopied] = useState(false)
  const [progress, setProgress] = useState<GreekProgressSnapshot>(() =>
    getGreekProgressSnapshot(getGreekStudyProgress()),
  )
  const [xpBurst, setXpBurst] = useState<number | null>(null)
  const todayKey = useMemo(() => todayDateKey(), [])
  const dailyVerseAssignment = useMemo(() => buildDailyVerseAssignment(todayKey), [todayKey])

  const levelKey = `${pilot.bookSlug}-${pilot.chapter}-${verse}`
  const onDailyVerse = levelKey === dailyVerseAssignment.levelKey
  const weakWordSet = useMemo(() => buildWeakWordSet(wordMemory, 2), [wordMemory])
  const levelProgressPct = questTargetIndexes.length
    ? Math.round((completedTargetIndexes.length / questTargetIndexes.length) * 100)
    : 0
  const verseProgress = `${Math.max(3, (verse / pilot.maxVerse) * 100)}%`

  const verseSwipeStartX = useRef<number | null>(null)
  const verseSwipeStartY = useRef<number | null>(null)
  const menuSwipeStartY = useRef<number | null>(null)
  const menuSwipeCurrentY = useRef<number | null>(null)
  const detailSwipeStartY = useRef<number | null>(null)
  const detailSwipeCurrentY = useRef<number | null>(null)
  const detailSwipeStartX = useRef<number | null>(null)
  const detailSwipeCurrentX = useRef<number | null>(null)
  const detailSwipeStartedAt = useRef<number | null>(null)
  const detailContentRef = useRef<HTMLDivElement | null>(null)
  const [detailDragOffsetY, setDetailDragOffsetY] = useState(0)
  const initializedDailySession = useRef(false)

  const refreshProgress = useCallback(() => {
    setProgress(getGreekProgressSnapshot(getGreekStudyProgress()))
  }, [])

  const refreshWordMemory = useCallback(() => {
    setWordMemory(getGreekWordMemory())
  }, [])

  const awardProgress = useCallback(
    (event: Parameters<typeof recordGreekStudyEvent>[0]) => {
      const { progress: updated, awardedXp } = recordGreekStudyEvent(event)
      setProgress(getGreekProgressSnapshot(updated))
      if (awardedXp > 0) setXpBurst(awardedXp)
      return awardedXp
    },
    [],
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "fx_devotions_greek_v1_progress") refreshProgress()
      if (!e.key || e.key === "fx_devotions_greek_v1_word_memory") refreshWordMemory()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refreshProgress, refreshWordMemory])

  useEffect(() => {
    if (xpBurst == null) return
    const t = window.setTimeout(() => setXpBurst(null), 1300)
    return () => window.clearTimeout(t)
  }, [xpBurst])

  useEffect(() => {
    if (!microWinBurst) return
    const t = window.setTimeout(() => setMicroWinBurst(null), 1500)
    return () => window.clearTimeout(t)
  }, [microWinBurst])

  useEffect(() => {
    if (!hydrated) return
    if (initializedDailySession.current) return
    initializedDailySession.current = true
    const stored = getDailyVerseRunState()
    const doneToday =
      stored?.date === todayKey &&
      stored.levelKey === dailyVerseAssignment.levelKey &&
      stored.completed === true
    setDailyVerseRunDone(doneToday)
    saveDailyVerseRunState({
      date: todayKey,
      levelKey: dailyVerseAssignment.levelKey,
      completed: doneToday,
    })
    setPilotIdx(dailyVerseAssignment.pilotIdx)
    setVerse(dailyVerseAssignment.verse)
  }, [
    hydrated,
    todayKey,
    dailyVerseAssignment.levelKey,
    dailyVerseAssignment.pilotIdx,
    dailyVerseAssignment.verse,
  ])

  useEffect(() => {
    if (loading) {
      setSelectedWordIndex(null)
      setQuestStage("challenge")
      setQuestChallenge(null)
      setCompletedTargetIndexes([])
      setCorrectTargetIndexes([])
      setLevelComplete(null)
    }
  }, [loading])

  useEffect(() => {
    if (!hydrated || loading) return
    setSelectedWordIndex(null)
    setQuestStage("challenge")
    setQuestChallenge(null)
    setCompletedTargetIndexes([])
    setCorrectTargetIndexes([])
    setLevelComplete(null)
    const targets = pickQuestTargetIndexes(greekTokens, weakWordSet, wordMemory, reviewMode)
    setQuestTargetIndexes(targets)
    if (targets.length > 0) {
      setQuestChallenge(buildChallengeForTarget(greekTokens, targets[0]))
    } else {
      setQuestChallenge(null)
    }
  }, [hydrated, loading, verse, pilot.bookSlug, pilot.chapter, greekTokens, reviewMode, weakWordSet, wordMemory])

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeDetails = useCallback(() => {
    setSelectedWordIndex(null)
    setQuestStage("challenge")
    setCoachPayload(null)
    setCoachError(null)
    setCoachLoading(false)
    setCoachTokenKey(null)
    setCoachQuestion("")
    setCoachHistory([])
    setCoachCopied(false)
  }, [])

  useEffect(() => {
    if (selectedWordIndex == null) setDetailDragOffsetY(0)
  }, [selectedWordIndex])

  const applyRolodexSelectionAndClose = useCallback(() => {
    applyRolodexSelection()
    closeMenu()
  }, [applyRolodexSelection, closeMenu])

  const jumpToDailyVerse = useCallback(() => {
    setPilotIdx(dailyVerseAssignment.pilotIdx)
    setVerse(dailyVerseAssignment.verse)
    setMenuOpen(false)
  }, [dailyVerseAssignment.pilotIdx, dailyVerseAssignment.verse])

  const finishVerseIfComplete = useCallback(
    (nextCompleted: number[], nextCorrect: number[]) => {
      const uniqueDone = Array.from(new Set(nextCompleted))
      const uniqueCorrect = Array.from(new Set(nextCorrect))
      if (questTargetIndexes.length === 0) return
      if (uniqueDone.length < questTargetIndexes.length) return
      if (levelComplete?.levelKey === levelKey) return
      const learnedWords = uniqueDone.reduce((acc, idx) => {
        const token = greekTokens[idx]
        if (!token) return acc
        const familiarity = wordMemory[wordFormKey(token)]?.familiarity
        return familiarity === "learned" ? acc + 1 : acc
      }, 0)
      const correctWords = uniqueCorrect.length
      const accuracy = correctWords / questTargetIndexes.length
      const levelXp = correctWords > 0 ? Math.max(4, Math.round(LEVEL_COMPLETE_XP * accuracy)) : 0
      const encouragement =
        correctWords === 0
          ? "Level complete - answer correctly to earn XP."
          : learnedWords >= Math.ceil(questTargetIndexes.length / 2)
            ? "Strong verse run - your recall is improving."
            : "Level complete - keep tapping and these forms will stick."
      const awarded =
        levelXp > 0
          ? awardProgress({
              kind: "verse",
              key: `${levelKey}-quest-complete`,
              xp: levelXp,
            })
          : 0
      setLevelComplete({
        levelKey,
        xpGained: awarded,
        correctWords,
        learnedWords,
        encouragement,
      })
      setMicroWinBurst(correctWords > 0 ? "Level complete" : "Level complete - no XP")
      if (!dailyVerseRunDone && levelKey === dailyVerseAssignment.levelKey) {
        const perfectDailyRun = correctWords === questTargetIndexes.length
        if (perfectDailyRun) {
          awardProgress({
            kind: "session",
            key: `${DAILY_VERSE_RUN_KEY}-${todayKey}-${dailyVerseAssignment.levelKey}`,
            xp: PERFECT_LEVEL_BONUS_XP,
          })
        }
        setDailyVerseRunDone(true)
        saveDailyVerseRunState({
          date: todayKey,
          levelKey: dailyVerseAssignment.levelKey,
          completed: true,
        })
        setMicroWinBurst(perfectDailyRun ? "Daily run complete + bonus XP" : "Daily run complete")
      }
    },
    [
      questTargetIndexes,
      levelComplete?.levelKey,
      levelKey,
      greekTokens,
      wordMemory,
      awardProgress,
      dailyVerseRunDone,
      todayKey,
      dailyVerseAssignment.levelKey,
    ],
  )

  const handleSelectGreekWord = useCallback(
    (wordIndex: number) => {
      if (!questTargetIndexes.includes(wordIndex)) return
      setSelectedWordIndex(wordIndex)
      setQuestStage("challenge")
      setCoachPayload(null)
      setCoachError(null)
      setCoachLoading(false)
      setCoachTokenKey(null)
      setCoachQuestion("")
      setCoachHistory([])
      setCoachCopied(false)
      const challenge = buildChallengeForTarget(greekTokens, wordIndex)
      setQuestChallenge(challenge)
    },
    [questTargetIndexes, greekTokens],
  )

  const revealQuestWord = useCallback(
    (wasCorrect: boolean) => {
      if (selectedWordIndex == null) return
      const token = greekTokens[selectedWordIndex]
      if (!token) return
      const key = wordFormKey(token)
      const { memory, previouslySeen, entry } = recordGreekWordMemoryTap(key, wasCorrect)
      setWordMemory(memory)
      setQuestStage("revealed")

      if (wasCorrect) {
        awardProgress({
          kind: "word",
          key: `${levelKey}-${selectedWordIndex}-quiz-correct`,
          xp: WORD_XP,
          wordFormKey: key,
        })
      }

      if (!wasCorrect) {
        setMicroWinBurst(`Not quite: ${token.word}`)
      } else if (entry.familiarity === "learned") {
        setMicroWinBurst(`Learned: ${token.word}`)
      } else if (previouslySeen || entry.familiarity === "seen") {
        setMicroWinBurst(`Seen again: ${token.word}`)
      } else {
        setMicroWinBurst(`New form: ${token.word}`)
      }

      const nextCompleted = completedTargetIndexes.includes(selectedWordIndex)
        ? completedTargetIndexes
        : [...completedTargetIndexes, selectedWordIndex]
      setCompletedTargetIndexes(nextCompleted)
      const nextCorrect = wasCorrect
        ? correctTargetIndexes.includes(selectedWordIndex)
          ? correctTargetIndexes
          : [...correctTargetIndexes, selectedWordIndex]
        : correctTargetIndexes
      if (wasCorrect) {
        setCorrectTargetIndexes(nextCorrect)
      }
      finishVerseIfComplete(nextCompleted, nextCorrect)
    },
    [
      selectedWordIndex,
      greekTokens,
      awardProgress,
      levelKey,
      completedTargetIndexes,
      correctTargetIndexes,
      finishVerseIfComplete,
    ],
  )

  const continueQuest = useCallback(() => {
    if (selectedWordIndex == null) return
    const remaining = questTargetIndexes.filter(
      (idx) => !completedTargetIndexes.includes(idx) && idx !== selectedWordIndex,
    )
    if (remaining.length === 0) {
      closeDetails()
      return
    }
    const nextIndex = remaining[0]
    setSelectedWordIndex(nextIndex)
    setQuestStage("challenge")
    setQuestChallenge(buildChallengeForTarget(greekTokens, nextIndex))
  }, [selectedWordIndex, questTargetIndexes, completedTargetIndexes, closeDetails, greekTokens])

  const onVerseTouchStart = useCallback((e: TouchEvent) => {
    verseSwipeStartX.current = e.changedTouches[0]?.clientX ?? null
    verseSwipeStartY.current = e.changedTouches[0]?.clientY ?? null
  }, [])

  const onVerseTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (menuOpen || selectedWordIndex != null) return
      const start = verseSwipeStartX.current
      const startY = verseSwipeStartY.current
      verseSwipeStartX.current = null
      verseSwipeStartY.current = null
      if (start == null || startY == null) return
      const end = e.changedTouches[0]?.clientX
      const endY = e.changedTouches[0]?.clientY
      if (end == null || endY == null) return
      const dx = end - start
      const dy = endY - startY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const mostlyHorizontal = absDx >= absDy * VERSE_SWIPE_HORIZONTAL_RATIO
      if (!mostlyHorizontal || absDx < VERSE_SWIPE_MIN_X) return
      if (dx > 0) prevVerse()
      else nextVerse()
    },
    [menuOpen, selectedWordIndex, prevVerse, nextVerse],
  )

  const onMenuTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const y = e.changedTouches[0]?.clientY
    if (typeof y !== "number") return
    menuSwipeStartY.current = y
    menuSwipeCurrentY.current = y
  }, [])

  const onMenuTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const y = e.changedTouches[0]?.clientY
    if (typeof y !== "number") return
    menuSwipeCurrentY.current = y
  }, [])

  const onMenuTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const startY = menuSwipeStartY.current
      const endY = menuSwipeCurrentY.current ?? e.changedTouches[0]?.clientY ?? null
      menuSwipeStartY.current = null
      menuSwipeCurrentY.current = null
      if (startY == null || endY == null) return
      if (endY - startY > MENU_SWIPE_CLOSE_THRESHOLD) closeMenu()
    },
    [closeMenu],
  )

  const onDetailTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const y = e.changedTouches[0]?.clientY
    const x = e.changedTouches[0]?.clientX
    if (typeof y !== "number" || typeof x !== "number") return
    detailSwipeStartY.current = y
    detailSwipeCurrentY.current = y
    detailSwipeStartX.current = x
    detailSwipeCurrentX.current = x
    detailSwipeStartedAt.current = Date.now()
  }, [])

  const onDetailTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const y = e.changedTouches[0]?.clientY
      const x = e.changedTouches[0]?.clientX
      if (typeof y !== "number" || typeof x !== "number") return
      detailSwipeCurrentY.current = y
      detailSwipeCurrentX.current = x
      const startY = detailSwipeStartY.current
      const startX = detailSwipeStartX.current
      if (startY == null || startX == null) return
      const deltaY = y - startY
      const deltaX = Math.abs(x - startX)
      const atTop = (detailContentRef.current?.scrollTop ?? 0) <= 4
      const mostlyVertical = deltaY > 0 && deltaY > deltaX * 1.15
      if (atTop && mostlyVertical) {
        setDetailDragOffsetY(Math.min(170, deltaY * 0.85))
      } else if (detailDragOffsetY !== 0) {
        setDetailDragOffsetY(0)
      }
    },
    [detailDragOffsetY],
  )

  const onDetailTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const startY = detailSwipeStartY.current
      const endY = detailSwipeCurrentY.current ?? e.changedTouches[0]?.clientY ?? null
      const startX = detailSwipeStartX.current
      const endX = detailSwipeCurrentX.current ?? e.changedTouches[0]?.clientX ?? null
      const startedAt = detailSwipeStartedAt.current
      detailSwipeStartY.current = null
      detailSwipeCurrentY.current = null
      detailSwipeStartX.current = null
      detailSwipeCurrentX.current = null
      detailSwipeStartedAt.current = null
      if (startY == null || endY == null || startX == null || endX == null) return
      const deltaY = endY - startY
      const deltaX = Math.abs(endX - startX)
      const atTop = (detailContentRef.current?.scrollTop ?? 0) <= 4
      const elapsedMs = startedAt == null ? 999 : Math.max(1, Date.now() - startedAt)
      const velocity = deltaY / elapsedMs
      const shouldClose =
        atTop &&
        deltaY > 0 &&
        deltaY > deltaX * 1.15 &&
        (deltaY > DETAIL_SWIPE_CLOSE_THRESHOLD || velocity > DETAIL_SWIPE_CLOSE_VELOCITY)
      if (shouldClose) closeDetails()
      setDetailDragOffsetY(0)
    },
    [closeDetails],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedWordIndex != null) closeDetails()
        else closeMenu()
      } else if (e.key === "ArrowLeft" && !menuOpen && selectedWordIndex == null) {
        e.preventDefault()
        prevVerse()
      } else if (e.key === "ArrowRight" && !menuOpen && selectedWordIndex == null) {
        e.preventDefault()
        nextVerse()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen, selectedWordIndex, closeMenu, closeDetails, prevVerse, nextVerse])

  const selectedToken =
    selectedWordIndex != null && selectedWordIndex >= 0 ? greekTokens[selectedWordIndex] ?? null : null
  const selectedTokenLearningClues = selectedToken ? buildGreekWordLearningClues(selectedToken) : null
  const selectedMemory = selectedToken ? wordMemory[wordFormKey(selectedToken)] : null
  const selectedFamiliarity: GreekWordFamiliarity = selectedMemory?.familiarity ?? "new"
  const selectedFamiliarityLabel = getWordFamiliarityLabel(selectedFamiliarity)
  const defaultCoachQuestion = selectedTokenLearningClues?.articleFunctionHint
    ? "What is the article doing here?"
    : "Why is this form parsed this way?"
  const activeCoachKey =
    selectedToken && selectedWordIndex != null
      ? `${levelKey}-${selectedWordIndex}-${selectedToken.word}`
      : null
  const verseGreekContext = greekTokens.map((tok) => tok.word).join(" ")
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
  const coachMicroFocus = selectedTokenLearningClues?.parseTemplate ?? selectedToken?.parse ?? ""

  useEffect(() => {
    if (!activeCoachKey) {
      setCoachPayload(null)
      setCoachError(null)
      setCoachQuestion("")
      setCoachHistory([])
      setCoachCopied(false)
      return
    }
    if (coachTokenKey?.startsWith(`${activeCoachKey}|`)) return
    setCoachPayload(null)
    setCoachError(null)
    setCoachQuestion("")
    setCoachHistory([])
    setCoachCopied(false)
  }, [activeCoachKey, coachTokenKey])

  const runCoach = useCallback(async (explicitQuestion?: string) => {
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
          parseSummary: selectedTokenLearningClues?.quickReason ?? selectedToken.parse,
          english,
          verseGreek: verseGreekContext,
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
  }, [
    selectedToken,
    activeCoachKey,
    coachLoading,
    coachTokenKey,
    coachPayload,
    coachQuestion,
    passageRef,
    english,
    verseGreekContext,
    selectedTokenLearningClues?.quickReason,
    awardProgress,
  ])

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
      `Word: ${selectedToken?.word ?? ""}`,
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
  }, [coachPayload, selectedToken?.word, coachQuestion])

  const clearCoachHistory = useCallback(() => {
    setCoachHistory([])
  }, [])

  const dailyXpPct = Math.max(0, Math.min(100, (progress.todayXp / progress.dailyGoalXp) * 100))

  return (
    <div className="fixed inset-0 z-[60] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#172033,transparent_44%),linear-gradient(to_bottom,#05070f,#030407,#010103)] text-white">
      <header className="shrink-0 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 sm:px-5 pt-[max(0.55rem,env(safe-area-inset-top))] pb-2">
          <Link
            href="/devotions"
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
          <div className="text-center min-w-0 px-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300/70">Verse Quest</p>
            <p className="text-sm text-white/80 truncate">{pilot.label}</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
            aria-label="Open study controls"
          >
            <Menu className="size-3.5" />
            Menu
          </button>
        </div>
        <div className="flex justify-center pb-2 px-3">
          <Link
            href="/devotions/greek"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/90 hover:bg-amber-500/20"
          >
            <BookOpen className="size-3.5" />
            Grammar reader
          </Link>
        </div>
        <div className="px-4 pb-3 sm:px-8 md:px-14">
          <div className="mx-auto max-w-5xl space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/12">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-300/85 via-emerald-300/90 to-cyan-300/80"
                style={{ width: `${dailyXpPct}%` }}
                animate={xpBurst != null ? { filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"] } : undefined}
                transition={xpBurst != null ? { duration: 0.4 } : undefined}
              />
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300/80 via-emerald-300/85 to-emerald-200/90 transition-[width] duration-250"
                style={{ width: `${levelProgressPct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {xpBurst != null ? (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.92 }}
            transition={{ duration: 0.24 }}
            className="pointer-events-none absolute right-4 top-[max(3.5rem,calc(env(safe-area-inset-top)+3rem))] z-[74] rounded-full border border-emerald-300/50 bg-emerald-400/25 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-50"
          >
            +{xpBurst} XP
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {microWinBurst ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            transition={{ duration: 0.24 }}
            className="pointer-events-none absolute left-4 top-[max(3.5rem,calc(env(safe-area-inset-top)+3rem))] z-[74] rounded-full border border-cyan-300/50 bg-cyan-400/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-50"
          >
            {microWinBurst}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {levelComplete ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-none absolute left-1/2 top-[max(5.6rem,calc(env(safe-area-inset-top)+5rem))] z-[74] w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl border border-emerald-300/45 bg-black/55 px-4 py-3 backdrop-blur-lg"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/90">Level Complete</p>
            <p className="mt-1 text-sm text-white/90">{levelComplete.encouragement}</p>
            <p className="mt-1 text-xs text-white/70">
              +{levelComplete.xpGained} XP · Learned words {levelComplete.learnedWords}/{questTargetIndexes.length}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[70] bg-black/65 px-3 pt-[max(4.75rem,calc(env(safe-area-inset-top)+4.35rem))] backdrop-blur-sm sm:px-6"
            onClick={closeMenu}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.985 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mx-auto w-full max-w-2xl rounded-3xl border border-white/20 bg-[#0a1020]/95 p-4 sm:p-5"
              role="dialog"
              aria-label="Study controls"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={onMenuTouchStart}
              onTouchMove={onMenuTouchMove}
              onTouchEnd={onMenuTouchEnd}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-200/80">
                  <Sparkles className="size-3.5" />
                  Verse controls
                </p>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white/75 hover:bg-white/[0.12]"
                  aria-label="Close study controls"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/15 bg-black/25 p-3 sm:p-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Verse rolodex</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/45">Book</span>
                      <select
                        value={rolodexBookSlug}
                        onChange={(e) => {
                          const nextBook = e.target.value
                          const firstChapter = MORPH_PILOT_CHAPTERS.find((item) => item.bookSlug === nextBook)
                          setRolodexBookSlug(nextBook)
                          if (firstChapter) {
                            setRolodexChapter(firstChapter.chapter)
                            setRolodexVerse((current) => Math.min(current, firstChapter.maxVerse))
                          }
                        }}
                        className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 font-mono text-sm text-white focus:border-emerald-300/50 focus:outline-none"
                        aria-label="Select Greek study book"
                      >
                        {rolodexBooks.map((item) => (
                          <option key={item.bookSlug} value={item.bookSlug}>
                            {item.bookName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/45">Chapter</span>
                      <select
                        value={rolodexChapter}
                        onChange={(e) => {
                          const nextChapter = Number.parseInt(e.target.value, 10)
                          const chapterItem = rolodexChapters.find((item) => item.chapter === nextChapter)
                          setRolodexChapter(nextChapter)
                          if (chapterItem) {
                            setRolodexVerse((current) => Math.min(current, chapterItem.maxVerse))
                          }
                        }}
                        className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 font-mono text-sm text-white focus:border-emerald-300/50 focus:outline-none"
                        aria-label="Select Greek study chapter"
                      >
                        {rolodexChapters.map((item) => (
                          <option key={`${item.bookSlug}-${item.chapter}`} value={item.chapter}>
                            {item.chapter}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/45">Verse</span>
                      <select
                        value={rolodexVerse}
                        onChange={(e) => setRolodexVerse(Number.parseInt(e.target.value, 10))}
                        className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 font-mono text-sm text-white focus:border-emerald-300/50 focus:outline-none"
                        aria-label="Select Greek study verse"
                      >
                        {rolodexVerseOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
                      {selectedRolodexChapter.label}:{rolodexVerse}
                    </p>
                    <button
                      type="button"
                      onClick={applyRolodexSelectionAndClose}
                      className="rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-400/25"
                    >
                      Go to verse
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={jumpToDailyVerse}
                    className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                      onDailyVerse
                        ? dailyVerseRunDone
                          ? "border-emerald-300/45 bg-emerald-400/18 text-emerald-50"
                          : "border-emerald-300/45 bg-emerald-300/12 text-emerald-100"
                        : "border-emerald-300/40 bg-emerald-400/12 text-emerald-100 hover:bg-emerald-400/20"
                    }`}
                  >
                    {onDailyVerse
                      ? dailyVerseRunDone
                        ? "Daily run complete"
                        : "Today's run active"
                      : `Daily verse ${dailyVerseAssignment.label}:${dailyVerseAssignment.verse}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewMode((v) => !v)}
                    className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                      reviewMode
                        ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                        : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                    }`}
                  >
                    {reviewMode ? "Review On" : "Review Mode"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWordHintsEnabled((v) => !v)}
                    className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                      wordHintsEnabled
                        ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                        : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                    }`}
                  >
                    {wordHintsEnabled ? "Hints On" : "Hints Off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEnglish((v) => !v)}
                    className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                      showEnglish
                        ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                        : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                    }`}
                  >
                    {showEnglish ? "English On" : "English Off"}
                  </button>
                  <Link
                    href={readerUrl}
                    onClick={closeMenu}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
                  >
                    Full Reader
                    <ExternalLink className="size-3.5 opacity-70" />
                  </Link>
                  <Link
                    href="/devotions/greek"
                    onClick={closeMenu}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200/90 hover:bg-amber-500/20"
                  >
                    Grammar reader
                    <BookOpen className="size-3.5 opacity-80" />
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={closeMenu}
                  className="w-full rounded-2xl border border-white/20 bg-white/[0.04] py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/80 hover:bg-white/[0.1]"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main
        className="flex-1 min-h-0 overflow-y-auto px-4 pb-28 pt-5 sm:px-8 md:px-14"
        onTouchStart={onVerseTouchStart}
        onTouchEnd={onVerseTouchEnd}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-white/55">
            <span
              className={`rounded-full border px-2.5 py-1 ${
                onDailyVerse
                  ? dailyVerseRunDone
                    ? "border-emerald-300/45 bg-emerald-400/14 text-emerald-50"
                    : "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                  : "border-white/20 bg-white/[0.03] text-white/70"
              }`}
            >
              <Target className="mr-1 inline size-3.5" />
              {onDailyVerse
                ? dailyVerseRunDone
                  ? "Daily run done"
                  : "Daily run in progress"
                : `Today ${dailyVerseAssignment.label}:${dailyVerseAssignment.verse}`}
            </span>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1">
              Targets {completedTargetIndexes.length}/{questTargetIndexes.length}
            </span>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1">
              Review {reviewMode ? "On" : "Off"}
            </span>
            <span className="rounded-full border border-white/20 bg-white/[0.03] px-2.5 py-1">
              Streak <Flame className="mx-1 inline size-3.5 text-orange-300/90" />
              {progress.streak}
            </span>
          </div>

          <div className="space-y-2 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300/75">{passageRef.replace(":", " · ")}</p>
            <div className="mx-auto h-1 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300/80 to-amber-300/80"
                style={{ width: verseProgress }}
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
              Verse {verse} of {pilot.maxVerse}
            </p>
            {onDailyVerse ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-emerald-200/70">
                {dailyVerseRunDone
                  ? "Daily run completed. Keep reviewing for mastery."
                  : "Daily verse run active. Clear all targets to complete today."}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-center text-sm text-red-300/90">{error}</p> : null}

          <section className="min-h-[56vh] sm:min-h-[60vh] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full max-w-3xl space-y-4 animate-pulse"
                >
                  <div className="h-10 rounded-xl bg-white/10" />
                  <div className="h-10 rounded-xl bg-white/10" />
                  <div className="h-10 rounded-xl bg-white/10" />
                </motion.div>
              ) : greekTokens.length > 0 ? (
                <motion.div
                  key={`${pilot.bookSlug}-${pilot.chapter}-${verse}`}
                  initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(3px)" }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  lang="el"
                  className="w-full text-center leading-[1.28] text-amber-100/95 flex flex-wrap justify-center gap-x-3 gap-y-4"
                  style={{ fontSize: "clamp(2.25rem, 8.4vw, 6rem)" }}
                >
                  {greekTokens.map((tok, wi) => {
                    const key = wordFormKey(tok)
                    const memory = wordMemory[key]
                    const familiarity = memory?.familiarity ?? "new"
                    const weakWord = weakWordSet.has(key)
                    const targetWord = questTargetIndexes.includes(wi)
                    const completedWord = completedTargetIndexes.includes(wi)
                    const selected = selectedWordIndex === wi
                    const hint = wordHintsEnabled ? getMorphHintAbbrev(tok) : null
                    return (
                      <span key={`${verse}-${wi}-${tok.word}`} className="inline-flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => handleSelectGreekWord(wi)}
                          disabled={!targetWord}
                          className={
                            selected
                              ? "border-b-2 border-amber-300/85 text-amber-200"
                              : !targetWord
                                ? "border-b border-transparent text-amber-100/35"
                                : weakWord
                                  ? "border-b border-dashed border-cyan-300/80 text-cyan-100 hover:border-cyan-200 hover:text-cyan-50"
                                  : familiarity === "learned"
                                    ? "border-b border-dashed border-emerald-300/70 text-emerald-100 hover:border-emerald-200 hover:text-emerald-50"
                                    : "border-b border-dashed border-amber-300/55 text-amber-100/95 hover:border-amber-300/80 hover:text-amber-50"
                          }
                        >
                          {tok.word}
                        </button>
                        {targetWord ? (
                          <span className="mt-0.5 font-mono text-[8px] sm:text-[9px] text-white/55">
                            {completedWord ? "done" : familiarity}
                          </span>
                        ) : null}
                        {hint ? (
                          <span className="mt-0.5 font-mono text-[9px] sm:text-[10px] text-amber-400/70">{hint}</span>
                        ) : null}
                      </span>
                    )
                  })}
                </motion.div>
              ) : (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm text-white/45"
                >
                  Greek text unavailable for this verse.
                </motion.p>
              )}
            </AnimatePresence>
          </section>

          {showEnglish && english ? (
            <p className="mx-auto max-w-3xl text-center text-white/70 leading-relaxed" style={{ fontSize: "clamp(1.05rem, 3.3vw, 1.6rem)" }}>
              {english}
            </p>
          ) : null}
        </div>
      </main>

      <AnimatePresence>
        {selectedToken ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[66] flex items-end"
          >
            <button
              type="button"
              aria-label="Close word details"
              className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
              onClick={closeDetails}
            />
            <motion.section
              initial={{ y: "100%" }}
              animate={{ y: detailDragOffsetY }}
              exit={{ y: "100%" }}
              transition={detailDragOffsetY > 0 ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 360 }}
              className="relative z-[67] w-full rounded-t-3xl border-t border-white/20 bg-[#060b14]/95"
              onTouchStart={onDetailTouchStart}
              onTouchMove={onDetailTouchMove}
              onTouchEnd={onDetailTouchEnd}
              onTouchCancel={() => {
                detailSwipeStartY.current = null
                detailSwipeCurrentY.current = null
                detailSwipeStartX.current = null
                detailSwipeCurrentX.current = null
                detailSwipeStartedAt.current = null
                setDetailDragOffsetY(0)
              }}
            >
              <div
                ref={detailContentRef}
                className="mx-auto max-h-[68vh] w-full max-w-4xl overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6"
              >
                <div data-detail-swipe-handle className="mb-2 flex flex-col items-center gap-1.5 pb-1 text-center select-none">
                  <div className="h-1.5 w-14 rounded-full bg-white/25" />
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Swipe down from here to close</p>
                </div>
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Verse Quest · Word</p>
                    <p className="mt-0.5 text-sm text-white/80" lang="el">
                      {selectedToken.word}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDetails}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white/70 hover:bg-white/[0.12]"
                    aria-label="Close word details"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {questStage === "challenge" && questChallenge?.targetIndex === selectedWordIndex ? (
                  <div className="mb-3 rounded-xl border border-cyan-300/30 bg-cyan-400/[0.08] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100/85">Quick challenge</p>
                    <p className="mt-1 text-sm text-white/85">{questChallenge.prompt}</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {questChallenge.options.map((option, idx) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => revealQuestWord(idx === questChallenge.correctOptionIndex)}
                          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-left text-sm text-white/88 hover:bg-black/45"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => revealQuestWord(false)}
                      className="mt-2 rounded-lg border border-white/20 bg-white/[0.03] px-3 py-1.5 text-xs text-white/72 hover:bg-white/[0.08]"
                    >
                      Reveal without guessing
                    </button>
                  </div>
                ) : null}

                {questStage === "revealed" ? (
                  <div className="mb-3 rounded-xl border border-emerald-300/30 bg-emerald-400/[0.08] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100/85">Reveal</p>
                    <p className="mt-1 text-sm text-white/92">
                      Familiarity: <span className="text-emerald-100">{selectedFamiliarityLabel}</span>
                    </p>
                    <p className="mt-1 text-xs text-white/75">
                      {selectedTokenLearningClues?.quickReason ??
                        `Lemma ${selectedToken.lemma} · parse ${selectedToken.parse}`}
                    </p>
                    <div className="mt-2 rounded-2xl border border-emerald-300/25 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(3,14,20,0.55))] p-3 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/85">AI Greek Coach Lab</p>
                          <p className="mt-0.5 text-xs text-white/65">Quick actions, follow-up prompts, and re-ask history.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAskCoach()}
                          disabled={!coachCanAsk}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-300/45 bg-emerald-400/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-50 hover:bg-emerald-400/35 disabled:opacity-60"
                        >
                          <Lightbulb className="size-3.5" />
                          {coachLoading ? "Thinking..." : "Coach me"}
                        </button>
                      </div>

                      <div className="mt-3 rounded-xl border border-white/15 bg-black/25 p-2.5">
                        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Current focus</p>
                        <p className="mt-1 text-xs text-white/82">
                          {selectedToken.word} ({selectedToken.lemma}) - {coachMicroFocus}
                        </p>
                      </div>

                      <div className="mt-3 space-y-2">
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

                      <div className="mt-3 flex flex-wrap items-center gap-2">
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
                        <div className="mt-3 rounded-xl border border-white/15 bg-black/25 p-3">
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
                        <p className="mt-3 rounded-lg border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-200/95">{coachError}</p>
                      ) : null}
                      {coachLoading ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-3 rounded-xl border border-emerald-200/25 bg-black/30 p-3"
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
                          className="mt-3 space-y-2 rounded-xl border border-emerald-200/25 bg-black/25 p-3"
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
                            <p className="text-xs leading-relaxed text-emerald-200/85">
                              Reflection: {coachPayload.reflectionPrompt}
                            </p>
                          ) : null}
                        </motion.div>
                      ) : !coachLoading && !coachError ? (
                        <p className="mt-3 text-xs leading-relaxed text-white/62">
                          Tap quick actions to drill grammar, syntax, and prayer applications for this exact word.
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={continueQuest}
                      className="mt-2 rounded-lg border border-emerald-300/40 bg-emerald-400/20 px-3 py-1.5 text-xs text-emerald-50 hover:bg-emerald-400/30"
                    >
                      Continue quest
                    </button>
                  </div>
                ) : null}

                <MorphologySidebarPanel token={selectedToken} verseNumber={verse} wordIndex={selectedWordIndex ?? 0} />
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <footer className="shrink-0 border-t border-white/10 bg-black/30 backdrop-blur-xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-lg gap-3">
          <button
            type="button"
            onClick={prevVerse}
            disabled={verse <= 1 || loading}
            className="flex-1 min-h-[52px] rounded-xl border border-white/20 bg-white/[0.04] font-mono text-xs uppercase tracking-[0.16em] text-white/90 hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-40 inline-flex items-center justify-center gap-1"
            aria-label="Previous verse"
          >
            <ChevronLeft className="size-5" />
            Prev
          </button>
          <button
            type="button"
            onClick={nextVerse}
            disabled={verse >= pilot.maxVerse || loading}
            className="flex-1 min-h-[52px] rounded-xl border border-white/20 bg-white/[0.04] font-mono text-xs uppercase tracking-[0.16em] text-white/90 hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-40 inline-flex items-center justify-center gap-1"
            aria-label="Next verse"
          >
            Next
            <ChevronRight className="size-5" />
          </button>
        </div>
        <Link
          href={readerUrl}
          className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-amber-300/90 hover:text-amber-200"
        >
          Word study &amp; grammar in reader
          <ExternalLink className="size-3.5 opacity-80" />
        </Link>
      </footer>
    </div>
  )
}
