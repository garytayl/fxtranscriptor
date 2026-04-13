"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Flame, Menu, Sparkles, Target, X, Zap } from "lucide-react"
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
import {
  MORPH_PILOT_CHAPTERS,
  morphPilotPassageRef,
  morphPilotReaderUrl,
  type MorphPilotChapterMenuItem,
} from "@/lib/bible/morph-pilot-menu"
import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"

const STORAGE_KEY = "fx_devotions_greek_place_v1"
const VERSE_SWIPE_MIN_X = 84
const VERSE_SWIPE_HORIZONTAL_RATIO = 1.35
const MENU_SWIPE_CLOSE_THRESHOLD = 72
const DETAIL_SWIPE_CLOSE_THRESHOLD = 102
const DETAIL_SWIPE_CLOSE_VELOCITY = 0.72
const WORD_XP = 12
const LEVEL_COMPLETE_XP = 24
const PERFECT_LEVEL_BONUS_XP = 10
const QUEST_MIN_TARGETS = 3
const QUEST_MAX_TARGETS = 5
const DAILY_VERSE_RUN_KEY = "daily-verse-run"

type StoredPlace = { bookSlug: string; chapter: number; verse: number }
type PassageVerse = { number: number; text: string }
type QuestWordStage = "challenge" | "revealed"
type QuestWordChallenge = {
  targetIndex: number
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

function loadPlace(): StoredPlace | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as StoredPlace
    if (!p?.bookSlug || typeof p.chapter !== "number" || typeof p.verse !== "number") return null
    return p
  } catch {
    return null
  }
}

function savePlace(p: StoredPlace) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, "")
}

function wordFormKey(token: GreekMorphToken): string {
  return `${token.lemma}|${token.parse}`
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
  const pool = Array.from(new Set(tokens.map((t) => t.lemma)))
  const distractors = pool
    .filter((lemma) => lemma !== target.lemma)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 3)
  const optionSet = new Set<string>([target.lemma, ...distractors])
  const options = Array.from(optionSet)
  if (options.length < 2) return null
  options.sort((a, b) => a.localeCompare(b))
  const correctOptionIndex = options.findIndex((x) => x === target.lemma)
  if (correctOptionIndex < 0) return null
  return { targetIndex, options, correctOptionIndex }
}

export function GreekOneVerseClient() {
  const [pilotIdx, setPilotIdx] = useState(0)
  const [verse, setVerse] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [rolodexBookSlug, setRolodexBookSlug] = useState(MORPH_PILOT_CHAPTERS[0]?.bookSlug ?? "john")
  const [rolodexChapter, setRolodexChapter] = useState(MORPH_PILOT_CHAPTERS[0]?.chapter ?? 1)
  const [rolodexVerse, setRolodexVerse] = useState(1)
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [english, setEnglish] = useState("")
  const [greekTokens, setGreekTokens] = useState<GreekMorphToken[]>([])
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
  const [progress, setProgress] = useState<GreekProgressSnapshot>(() =>
    getGreekProgressSnapshot(getGreekStudyProgress()),
  )
  const [xpBurst, setXpBurst] = useState<number | null>(null)

  const pilot: MorphPilotChapterMenuItem = MORPH_PILOT_CHAPTERS[pilotIdx] ?? MORPH_PILOT_CHAPTERS[0]
  const passageRef = useMemo(() => morphPilotPassageRef(pilot, verse), [pilot, verse])
  const readerUrl = useMemo(
    () => morphPilotReaderUrl(pilot.bookSlug, pilot.chapter, verse),
    [pilot.bookSlug, pilot.chapter, verse],
  )
  const levelKey = `${pilot.bookSlug}-${pilot.chapter}-${verse}`
  const weakWordSet = useMemo(() => buildWeakWordSet(wordMemory, 2), [wordMemory])
  const levelProgressPct = questTargetIndexes.length
    ? Math.round((completedTargetIndexes.length / questTargetIndexes.length) * 100)
    : 0
  const verseProgress = `${Math.max(3, (verse / pilot.maxVerse) * 100)}%`

  const rolodexBooks = useMemo(() => {
    const seen = new Set<string>()
    return MORPH_PILOT_CHAPTERS.filter((item) => {
      if (seen.has(item.bookSlug)) return false
      seen.add(item.bookSlug)
      return true
    }).map((item) => ({
      bookSlug: item.bookSlug,
      bookName: item.bookName,
    }))
  }, [])
  const rolodexChapters = useMemo(
    () => MORPH_PILOT_CHAPTERS.filter((item) => item.bookSlug === rolodexBookSlug),
    [rolodexBookSlug],
  )
  const selectedRolodexChapter =
    rolodexChapters.find((item) => item.chapter === rolodexChapter) ?? rolodexChapters[0] ?? pilot
  const rolodexVerseOptions = useMemo(
    () => Array.from({ length: selectedRolodexChapter.maxVerse }, (_, idx) => idx + 1),
    [selectedRolodexChapter.maxVerse],
  )

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
    const s = loadPlace()
    if (s) {
      const idx = MORPH_PILOT_CHAPTERS.findIndex(
        (c) => c.bookSlug === s.bookSlug && c.chapter === s.chapter,
      )
      if (idx >= 0) {
        setPilotIdx(idx)
        const max = MORPH_PILOT_CHAPTERS[idx].maxVerse
        setVerse(Math.min(Math.max(1, s.verse), max))
      }
    }
    setHydrated(true)
  }, [])

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
    savePlace({ bookSlug: pilot.bookSlug, chapter: pilot.chapter, verse })
  }, [hydrated, pilot.bookSlug, pilot.chapter, verse])

  useEffect(() => {
    setRolodexBookSlug(pilot.bookSlug)
    setRolodexChapter(pilot.chapter)
    setRolodexVerse(verse)
  }, [pilot.bookSlug, pilot.chapter, verse])

  useEffect(() => {
    if (!hydrated) return
    if (initializedDailySession.current) return
    initializedDailySession.current = true
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return

    const controller = new AbortController()
    const ref = passageRef
    const t = FX_GREEK_GRAMMAR_TRANSLATION_KEY

    setLoading(true)
    setError(null)
    setSelectedWordIndex(null)
    setQuestStage("challenge")
    setQuestChallenge(null)
    setCompletedTargetIndexes([])
    setCorrectTargetIndexes([])
    setLevelComplete(null)

    const load = async () => {
      try {
        const [passRes, morphRes] = await Promise.all([
          fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(t)}`, {
            signal: controller.signal,
          }),
          fetch(`/api/bible/morph?ref=${encodeURIComponent(ref)}`, { signal: controller.signal }),
        ])
        const pass = (await passRes.json()) as Record<string, unknown>
        const morph = (await morphRes.json()) as Record<string, unknown>

        let passError: string | null = null
        let nextEnglish = ""
        if (!passRes.ok) {
          passError = typeof pass.error === "string" ? pass.error : "Could not load this verse."
        } else if (typeof pass.error === "string" && pass.error) {
          passError = pass.error
        } else {
          const verses = pass.verses as PassageVerse[] | undefined
          const row = verses?.find((v) => v.number === verse) ?? verses?.[0]
          nextEnglish = row?.text ? stripHtmlTags(row.text).replace(/\s+/g, " ").trim() : ""
        }

        let morphError: string | null = null
        let nextGreekTokens: GreekMorphToken[] = []
        if (!morphRes.ok) {
          morphError = typeof morph.error === "string" ? morph.error : "Could not load Greek morphology."
        } else if (typeof morph.error === "string" && morph.error && morph.available === false) {
          morphError = morph.error
        } else {
          const mVerses = morph.verses as { number: number; tokens: GreekMorphToken[] }[] | undefined
          const mv = mVerses?.find((x) => x.number === verse) ?? mVerses?.[0]
          nextGreekTokens = mv?.tokens ?? []
          if (nextGreekTokens.length === 0) morphError = "Could not load Greek morphology."
        }

        setEnglish(nextEnglish)
        setGreekTokens(nextGreekTokens)
        const targets = pickQuestTargetIndexes(nextGreekTokens, weakWordSet, wordMemory, reviewMode)
        setQuestTargetIndexes(targets)
        if (targets.length > 0) {
          setQuestChallenge(buildChallengeForTarget(nextGreekTokens, targets[0]))
        }
        if (passError && nextGreekTokens.length > 0) {
          setError("English translation unavailable right now. Greek grammar study is still available.")
        } else if (!passError && morphError && nextEnglish) {
          setError("Greek morphology unavailable for this verse.")
        } else if (passError) {
          setError(passError)
        } else if (morphError) {
          setError(morphError)
        } else {
          setError(null)
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError("Could not load this verse.")
        setEnglish("")
        setGreekTokens([])
        setQuestTargetIndexes([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [hydrated, passageRef, verse, reviewMode, weakWordSet, wordMemory])

  const prevVerse = useCallback(() => {
    setVerse((v) => Math.max(1, v - 1))
  }, [])

  const nextVerse = useCallback(() => {
    setVerse((v) => Math.min(pilot.maxVerse, v + 1))
  }, [pilot.maxVerse])

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeDetails = useCallback(() => {
    setSelectedWordIndex(null)
    setQuestStage("challenge")
  }, [])

  useEffect(() => {
    if (selectedWordIndex == null) setDetailDragOffsetY(0)
  }, [selectedWordIndex])

  const applyRolodexSelection = useCallback(() => {
    const targetPilotIdx = MORPH_PILOT_CHAPTERS.findIndex(
      (item) => item.bookSlug === rolodexBookSlug && item.chapter === rolodexChapter,
    )
    if (targetPilotIdx < 0) return
    const targetPilot = MORPH_PILOT_CHAPTERS[targetPilotIdx]
    const safeVerse = Math.min(Math.max(1, rolodexVerse), targetPilot.maxVerse)
    setPilotIdx(targetPilotIdx)
    setVerse(safeVerse)
  }, [rolodexBookSlug, rolodexChapter, rolodexVerse])

  const jumpToRolodex = useCallback(() => {
    applyRolodexSelection()
    closeMenu()
  }, [applyRolodexSelection, closeMenu])

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
      const runKey = `${levelKey}-${new Date().toISOString().slice(0, 10)}`
      if (!dailyVerseRunDone && correctWords === questTargetIndexes.length) {
        awardProgress({ kind: "session", key: `${DAILY_VERSE_RUN_KEY}-${runKey}`, xp: PERFECT_LEVEL_BONUS_XP })
        setDailyVerseRunDone(true)
      }
    },
    [questTargetIndexes, levelComplete?.levelKey, levelKey, greekTokens, wordMemory, awardProgress, dailyVerseRunDone],
  )

  const handleSelectGreekWord = useCallback(
    (wordIndex: number) => {
      if (!questTargetIndexes.includes(wordIndex)) return
      setSelectedWordIndex(wordIndex)
      setQuestStage("challenge")
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
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300/70">Verse Quest</p>
            <p className="text-sm text-white/80">{pilot.label}</p>
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
                      onClick={jumpToRolodex}
                      className="rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-400/25"
                    >
                      Go to verse
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
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
                    <p className="mt-1 text-sm text-white/85">Which lemma matches this word form?</p>
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
