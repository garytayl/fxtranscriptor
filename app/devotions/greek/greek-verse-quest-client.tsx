"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Flame,
  GraduationCap,
  Library,
  Menu,
  Target,
  X,
  XCircle,
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
import { useGreekUiPreferences } from "@/lib/devotions-greek-ui-preferences"

import { GreekCoachLab, type GreekQuizCoachContext } from "@/app/devotions/greek/greek-coach-lab"
import { GreekProgressStrip } from "@/app/devotions/greek/greek-progress-strip"
import { GreekMenuSection, GreekStudyMenuShell } from "@/app/devotions/greek/greek-study-menu-shell"
import { GreekWordBankOverlay } from "@/app/devotions/greek/greek-word-bank-overlay"
import {
  DETAIL_SWIPE_CLOSE_THRESHOLD,
  DETAIL_SWIPE_CLOSE_VELOCITY,
  MENU_SWIPE_CLOSE_THRESHOLD,
  useGreekPilotVerse,
  VERSE_SWIPE_HORIZONTAL_RATIO,
  VERSE_SWIPE_MIN_X,
} from "@/app/devotions/greek/greek-pilot-verse-shared"
import {
  buildChallengeForTarget,
  buildDailyVerseAssignment,
  DAILY_VERSE_RUN_KEY,
  getDailyVerseRunState,
  LEVEL_COMPLETE_XP,
  PERFECT_LEVEL_BONUS_XP,
  pickQuestTargetsInPhrase,
  saveDailyVerseRunState,
  todayDateKey,
  playQuestFeedbackSound,
  vibrateQuest,
  wordFormKey,
  WORD_XP,
  type DailyVerseAssignment,
  type DailyVerseRunState,
  type LevelCompleteState,
  type QuestQuizFeedback,
  type QuestWordChallenge,
  type QuestWordStage,
} from "@/app/devotions/greek/greek-verse-quest-logic"

export function GreekVerseQuestClient() {
  const {
    setPilotIdx,
    pilot,
    passageRef,
    readerUrl,
    hydrated,
    loading,
    error,
    english,
    greekTokens,
    verse,
    setVerse,
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
  const [wordBankOpen, setWordBankOpen] = useState(false)
  const { prefs: uiPrefs, updatePrefs: updateUiPrefs } = useGreekUiPreferences()
  const { wordHintsEnabled, showEnglish, reviewMode, hapticsEnabled, soundEffectsEnabled } = uiPrefs
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null)
  const [wordMemory, setWordMemory] = useState<GreekWordMemory>(() => getGreekWordMemory())
  const [questStage, setQuestStage] = useState<QuestWordStage>("challenge")
  const [questChallenge, setQuestChallenge] = useState<QuestWordChallenge | null>(null)
  const [questQuizFeedback, setQuestQuizFeedback] = useState<QuestQuizFeedback | null>(null)
  const [questTargetIndexes, setQuestTargetIndexes] = useState<number[]>([])
  const [questCluster, setQuestCluster] = useState<{ start: number; end: number } | null>(null)
  const [completedTargetIndexes, setCompletedTargetIndexes] = useState<number[]>([])
  const [correctTargetIndexes, setCorrectTargetIndexes] = useState<number[]>([])
  const [dailyVerseRunDone, setDailyVerseRunDone] = useState(false)
  const [levelComplete, setLevelComplete] = useState<LevelCompleteState | null>(null)
  const [microWinBurst, setMicroWinBurst] = useState<string | null>(null)
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

  const clusterGreekPreview = useMemo(() => {
    if (!questCluster || greekTokens.length === 0) return null
    const { start, end } = questCluster
    return greekTokens
      .slice(start, end + 1)
      .map((t) => t.word)
      .join(" ")
  }, [questCluster, greekTokens])

  const verseSwipeStartX = useRef<number | null>(null)
  const verseSwipeStartY = useRef<number | null>(null)
  const menuSwipeStartY = useRef<number | null>(null)
  const menuSwipeCurrentY = useRef<number | null>(null)
  const detailSwipeStartY = useRef<number | null>(null)
  const detailSwipeCurrentY = useRef<number | null>(null)
  const detailSwipeStartX = useRef<number | null>(null)
  const detailSwipeCurrentX = useRef<number | null>(null)
  const detailSwipeStartedAt = useRef<number | null>(null)
  const detailHandleSwipeStartY = useRef<number | null>(null)
  const detailPointerStartY = useRef<number | null>(null)
  const detailPointerStartX = useRef<number | null>(null)
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
    const t = window.setTimeout(() => setMicroWinBurst(null), 2200)
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
    const { targetIndexes: targets, clusterStart, clusterEnd } = pickQuestTargetsInPhrase(
      greekTokens,
      weakWordSet,
      wordMemory,
      reviewMode,
    )
    setQuestTargetIndexes(targets)
    setQuestCluster(targets.length > 0 ? { start: clusterStart, end: clusterEnd } : null)
    if (targets.length > 0) {
      setQuestChallenge(buildChallengeForTarget(greekTokens, targets[0]))
    } else {
      setQuestChallenge(null)
    }
    // Intentionally omit weakWordSet / wordMemory: updates from quiz taps must not reset
    // the word sheet (setSelectedWordIndex(null)) or verse progress mid-session.
  }, [hydrated, loading, verse, pilot.bookSlug, pilot.chapter, greekTokens, reviewMode])

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeDetails = useCallback(() => {
    setSelectedWordIndex(null)
    setQuestStage("challenge")
    setQuestQuizFeedback(null)
    detailSwipeStartY.current = null
    detailSwipeCurrentY.current = null
    detailSwipeStartX.current = null
    detailSwipeCurrentX.current = null
    detailSwipeStartedAt.current = null
    detailHandleSwipeStartY.current = null
    detailPointerStartY.current = null
    detailPointerStartX.current = null
    setDetailDragOffsetY(0)
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
      if (completedTargetIndexes.includes(wordIndex)) {
        setQuestStage("revealed")
        setQuestChallenge(null)
        setQuestQuizFeedback(null)
        return
      }
      setQuestQuizFeedback(null)
      const challenge = buildChallengeForTarget(greekTokens, wordIndex)
      if (challenge) {
        setQuestStage("challenge")
        setQuestChallenge(challenge)
      } else {
        setQuestStage("revealed")
        setQuestChallenge(null)
      }
    },
    [questTargetIndexes, completedTargetIndexes, greekTokens],
  )

  const revealQuestWord = useCallback(
    (wasCorrect: boolean, meta?: { chosenIndex?: number; skipped?: boolean }) => {
      if (selectedWordIndex == null) return
      const token = greekTokens[selectedWordIndex]
      if (!token) return

      const ch = questChallenge?.targetIndex === selectedWordIndex ? questChallenge : null
      const correctAnswer =
        ch && ch.correctOptionIndex >= 0 ? (ch.options[ch.correctOptionIndex] ?? "") : ""
      const chosenAnswer =
        meta?.chosenIndex != null && ch && meta.chosenIndex >= 0
          ? (ch.options[meta.chosenIndex] ?? "")
          : undefined

      if (ch) {
        if (meta?.skipped) {
          setQuestQuizFeedback({ outcome: "skipped", correctAnswer, prompt: ch.prompt })
          vibrateQuest("skipped", { hapticsEnabled })
          playQuestFeedbackSound("skipped", { soundEnabled: soundEffectsEnabled })
        } else if (wasCorrect) {
          setQuestQuizFeedback({ outcome: "correct", xpGained: WORD_XP, prompt: ch.prompt })
          vibrateQuest("correct", { hapticsEnabled })
          playQuestFeedbackSound("correct", { soundEnabled: soundEffectsEnabled })
        } else {
          setQuestQuizFeedback({
            outcome: "incorrect",
            correctAnswer,
            chosenAnswer: chosenAnswer || undefined,
            prompt: ch.prompt,
          })
          vibrateQuest("incorrect", { hapticsEnabled })
          playQuestFeedbackSound("incorrect", { soundEnabled: soundEffectsEnabled })
        }
      } else {
        setQuestQuizFeedback(null)
      }

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

      if (meta?.skipped) {
        setMicroWinBurst("Answer revealed — compare below")
      } else if (!wasCorrect) {
        setMicroWinBurst(`Not quite — ${correctAnswer ? "see panel" : "try the next word"}`)
      } else if (entry.familiarity === "learned") {
        setMicroWinBurst(`+${WORD_XP} XP · Learned: ${token.word}`)
      } else if (previouslySeen || entry.familiarity === "seen") {
        setMicroWinBurst(`+${WORD_XP} XP · Seen again: ${token.word}`)
      } else {
        setMicroWinBurst(`+${WORD_XP} XP · New form: ${token.word}`)
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
      questChallenge,
      awardProgress,
      levelKey,
      completedTargetIndexes,
      correctTargetIndexes,
      finishVerseIfComplete,
      hapticsEnabled,
      soundEffectsEnabled,
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
    setQuestQuizFeedback(null)
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
      if (menuOpen || wordBankOpen || selectedWordIndex != null) return
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
    [menuOpen, wordBankOpen, selectedWordIndex, prevVerse, nextVerse],
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
      const strongPullDown = deltaY > DETAIL_SWIPE_CLOSE_THRESHOLD * 1.5
      if (mostlyVertical && (atTop ? deltaY > DETAIL_SWIPE_CLOSE_THRESHOLD : strongPullDown)) {
        closeDetails()
        detailSwipeStartY.current = null
        detailSwipeCurrentY.current = null
        detailSwipeStartX.current = null
        detailSwipeCurrentX.current = null
        detailSwipeStartedAt.current = null
        setDetailDragOffsetY(0)
        return
      }
      if (atTop && mostlyVertical) {
        setDetailDragOffsetY(Math.min(170, deltaY * 0.85))
      } else if (detailDragOffsetY !== 0) {
        setDetailDragOffsetY(0)
      }
    },
    [detailDragOffsetY, closeDetails],
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
      const strongPullDown = deltaY > DETAIL_SWIPE_CLOSE_THRESHOLD * 1.5
      const shouldClose =
        deltaY > 0 &&
        deltaY > deltaX * 1.15 &&
        ((atTop && (deltaY > DETAIL_SWIPE_CLOSE_THRESHOLD || velocity > DETAIL_SWIPE_CLOSE_VELOCITY)) ||
          strongPullDown)
      if (shouldClose) closeDetails()
      setDetailDragOffsetY(0)
    },
    [closeDetails],
  )

  const onDetailHandleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const y = e.changedTouches[0]?.clientY
    detailHandleSwipeStartY.current = typeof y === "number" ? y : null
  }, [])

  const onDetailHandleTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const startY = detailHandleSwipeStartY.current
      detailHandleSwipeStartY.current = null
      const endY = e.changedTouches[0]?.clientY
      if (typeof startY !== "number" || typeof endY !== "number") return
      if (endY - startY > 48) closeDetails()
    },
    [closeDetails],
  )

  const onDetailHandleTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const startY = detailHandleSwipeStartY.current
      const currentY = e.changedTouches[0]?.clientY
      if (typeof startY !== "number" || typeof currentY !== "number") return
      if (currentY - startY > 36) {
        detailHandleSwipeStartY.current = null
        closeDetails()
      }
    },
    [closeDetails],
  )

  const resetDetailPointerGesture = useCallback(() => {
    detailPointerStartY.current = null
    detailPointerStartX.current = null
    setDetailDragOffsetY(0)
  }, [])

  const onDetailPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    detailPointerStartY.current = e.clientY
    detailPointerStartX.current = e.clientX
  }, [])

  const onDetailPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const startY = detailPointerStartY.current
      const startX = detailPointerStartX.current
      if (startY == null || startX == null) return
      const deltaY = e.clientY - startY
      const deltaX = Math.abs(e.clientX - startX)
      const atTop = (detailContentRef.current?.scrollTop ?? 0) <= 4
      const mostlyVertical = deltaY > 0 && deltaY > deltaX * 1.15
      const strongPullDown = deltaY > DETAIL_SWIPE_CLOSE_THRESHOLD * 1.5
      if (mostlyVertical && (atTop ? deltaY > DETAIL_SWIPE_CLOSE_THRESHOLD : strongPullDown)) {
        closeDetails()
        resetDetailPointerGesture()
        return
      }
      if (atTop && mostlyVertical) {
        setDetailDragOffsetY(Math.min(170, deltaY * 0.85))
      } else if (detailDragOffsetY !== 0) {
        setDetailDragOffsetY(0)
      }
    },
    [closeDetails, detailDragOffsetY, resetDetailPointerGesture],
  )

  const onDetailPointerUp = useCallback(() => {
    resetDetailPointerGesture()
  }, [resetDetailPointerGesture])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (wordBankOpen) setWordBankOpen(false)
        else if (selectedWordIndex != null) closeDetails()
        else closeMenu()
      } else if (e.key === "ArrowLeft" && !menuOpen && !wordBankOpen && selectedWordIndex == null) {
        e.preventDefault()
        prevVerse()
      } else if (e.key === "ArrowRight" && !menuOpen && !wordBankOpen && selectedWordIndex == null) {
        e.preventDefault()
        nextVerse()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen, wordBankOpen, selectedWordIndex, closeMenu, closeDetails, prevVerse, nextVerse])

  const selectedToken =
    selectedWordIndex != null && selectedWordIndex >= 0 ? greekTokens[selectedWordIndex] ?? null : null
  const selectedTokenLearningClues = selectedToken ? buildGreekWordLearningClues(selectedToken) : null
  const selectedMemory = selectedToken ? wordMemory[wordFormKey(selectedToken)] : null
  const selectedFamiliarity: GreekWordFamiliarity = selectedMemory?.familiarity ?? "new"
  const selectedFamiliarityLabel = getWordFamiliarityLabel(selectedFamiliarity)
  const verseGreekLine = greekTokens.map((tok) => tok.word).join(" ")

  const greekCoachQuizContext = useMemo((): GreekQuizCoachContext | null => {
    if (
      !questQuizFeedback ||
      !questChallenge ||
      selectedWordIndex == null ||
      questChallenge.targetIndex !== selectedWordIndex
    ) {
      return null
    }
    const correctAnswer = questChallenge.options[questChallenge.correctOptionIndex] ?? ""
    return {
      kind: questChallenge.kind,
      prompt: questQuizFeedback.prompt,
      options: questChallenge.options,
      correctAnswer,
      outcome: questQuizFeedback.outcome,
      chosenAnswer:
        questQuizFeedback.outcome === "incorrect" ? questQuizFeedback.chosenAnswer : undefined,
    }
  }, [questQuizFeedback, questChallenge, selectedWordIndex])

  const dailyXpPct = Math.max(0, Math.min(100, (progress.todayXp / progress.dailyGoalXp) * 100))

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#172033,transparent_44%),linear-gradient(to_bottom,#05070f,#030407,#010103)] text-white">
      <header className="relative z-[72] shrink-0 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 sm:px-5 pt-[max(0.55rem,env(safe-area-inset-top))] pb-2">
          <Link
            href="/devotions/greek"
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
          >
            <ArrowLeft className="size-3.5" />
            Greek
          </Link>
          <div className="text-center min-w-0 px-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300/70">Verse Quest</p>
            <p className="text-sm text-white/80 truncate">{pilot.label}</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.08]"
            aria-label="Open study menu"
          >
            <Menu className="size-3.5" />
            Study
          </button>
        </div>
        <div className="flex justify-center pb-2 px-3">
          <Link
            href="/devotions/greek/endings"
            className="mr-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200/90 hover:bg-cyan-500/20"
          >
            <GraduationCap className="size-3.5" />
            Endings Lab
          </Link>
          <Link
            href="/devotions/greek/reader"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/90 hover:bg-amber-500/20"
          >
            <BookOpen className="size-3.5" />
            Grammar Reader
          </Link>
        </div>
        <div className="px-4 pb-2.5 sm:px-8 md:px-14">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/45">Today&apos;s XP</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/12">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300/85 via-emerald-300/90 to-cyan-300/80"
                  style={{ width: `${dailyXpPct}%` }}
                  animate={xpBurst != null ? { filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"] } : undefined}
                  transition={xpBurst != null ? { duration: 0.4 } : undefined}
                />
              </div>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/45">Verse targets</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300/80 via-emerald-300/85 to-emerald-200/90 transition-[width] duration-250"
                  style={{ width: `${levelProgressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* In-flow feedback strip — avoids overlapping header, verse line, and toasts colliding */}
      <AnimatePresence mode="wait">
        {levelComplete ? (
          <motion.aside
            key="level-hud"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-[65] shrink-0 overflow-hidden border-b border-emerald-400/20 bg-emerald-950/40 px-3 py-2.5 sm:px-5"
            aria-live="polite"
          >
            <div className="mx-auto max-w-5xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/90">Level complete</p>
              <p className="mt-0.5 text-sm leading-snug text-white/90">{levelComplete.encouragement}</p>
              <p className="mt-1 text-xs leading-snug text-white/70">
                +{levelComplete.xpGained} XP · Learned words {levelComplete.learnedWords}/{questTargetIndexes.length}
              </p>
            </div>
          </motion.aside>
        ) : xpBurst != null || microWinBurst ? (
          <motion.aside
            key="burst-hud"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-[65] shrink-0 overflow-hidden border-b border-white/10 bg-black/35 px-3 py-2 sm:px-5"
            aria-live="polite"
          >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1">
              {microWinBurst ? (
                <p className="min-w-0 flex-1 font-mono text-[10px] uppercase leading-snug tracking-[0.14em] text-cyan-100/95">
                  {microWinBurst}
                </p>
              ) : null}
              {xpBurst != null ? (
                <p
                  className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-200/95 ${
                    microWinBurst ? "sm:ml-auto" : ""
                  }`}
                >
                  +{xpBurst} XP
                </p>
              ) : null}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <GreekStudyMenuShell
        open={menuOpen}
        onClose={closeMenu}
        title="Greek study menu"
        accent="emerald"
        onMenuTouchStart={onMenuTouchStart}
        onMenuTouchMove={onMenuTouchMove}
        onMenuTouchEnd={onMenuTouchEnd}
      >
        <div className="space-y-5">
          <GreekProgressStrip accent="emerald" dense />
          <GreekMenuSection label="Vocabulary">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setWordBankOpen(true)
              }}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-500/12 px-4 py-3 text-left transition-colors hover:bg-emerald-500/18"
            >
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-100">
                <Library className="size-4 shrink-0 opacity-90" aria-hidden />
                Words you&apos;re learning
              </span>
              <ChevronRight className="size-4 shrink-0 text-emerald-200/50" aria-hidden />
            </button>
            <Link
              href="/devotions/greek/words"
              onClick={closeMenu}
              className="block text-center font-mono text-[10px] text-emerald-400/65 underline-offset-2 hover:text-emerald-300/90"
            >
              Open full-page word bank
            </Link>
          </GreekMenuSection>

          <GreekMenuSection label="Verse location">
            <div className="rounded-2xl border border-white/14 bg-black/28 p-3 sm:p-4">
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
          </GreekMenuSection>

          <p className="rounded-xl border border-cyan-300/22 bg-cyan-500/10 px-3 py-2.5 text-[11px] leading-snug text-cyan-100/90">
            Tip: tap highlighted target words (status under each) to open the quiz and move through the verse.
          </p>

          <GreekMenuSection label="Quest session">
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
                onClick={() => updateUiPrefs({ reviewMode: !reviewMode })}
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
                onClick={() => updateUiPrefs({ wordHintsEnabled: !wordHintsEnabled })}
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
                onClick={() => updateUiPrefs({ showEnglish: !showEnglish })}
                className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                  showEnglish
                    ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                    : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {showEnglish ? "English On" : "English Off"}
              </button>
              <button
                type="button"
                onClick={() => updateUiPrefs({ hapticsEnabled: !hapticsEnabled })}
                className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                  hapticsEnabled
                    ? "border-violet-300/50 bg-violet-300/15 text-violet-100"
                    : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {hapticsEnabled ? "Haptics On" : "Haptics Off"}
              </button>
              <button
                type="button"
                onClick={() => updateUiPrefs({ soundEffectsEnabled: !soundEffectsEnabled })}
                className={`rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                  soundEffectsEnabled
                    ? "border-fuchsia-300/50 bg-fuchsia-300/15 text-fuchsia-100"
                    : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {soundEffectsEnabled ? "Sounds On" : "Sounds Off"}
              </button>
            </div>
          </GreekMenuSection>

          <GreekMenuSection label="Jump to">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/devotions/greek"
                onClick={closeMenu}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-200/90 hover:bg-emerald-500/18"
              >
                Greek home
              </Link>
              <Link
                href={readerUrl}
                onClick={closeMenu}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75 hover:bg-white/[0.1]"
              >
                Full Reader
                <ExternalLink className="size-3.5 opacity-70" />
              </Link>
              <Link
                href="/devotions/greek/endings"
                onClick={closeMenu}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/90 hover:bg-cyan-500/20"
              >
                Endings Lab
                <GraduationCap className="size-3.5 opacity-80" />
              </Link>
              <Link
                href="/devotions/greek/reader"
                onClick={closeMenu}
                className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200/90 hover:bg-amber-500/20"
              >
                Grammar Reader
                <BookOpen className="size-3.5 opacity-80" />
              </Link>
            </div>
          </GreekMenuSection>

          <button
            type="button"
            onClick={closeMenu}
            className="w-full rounded-2xl border border-white/18 bg-white/[0.05] py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/85 hover:bg-white/[0.1]"
          >
            Done
          </button>
        </div>
      </GreekStudyMenuShell>

      <GreekWordBankOverlay open={wordBankOpen} onClose={() => setWordBankOpen(false)} accent="emerald" />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_min(400px,38vw)] lg:overflow-hidden">
      <main
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 pb-32 pt-4 sm:px-8 md:px-14 lg:min-h-0 lg:pb-10"
        onTouchStart={onVerseTouchStart}
        onTouchEnd={onVerseTouchEnd}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 md:gap-7">
          <div className="flex shrink-0 flex-col gap-5">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[10px] font-mono uppercase tracking-[0.14em] text-white/55">
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

          <div className="space-y-3 text-center">
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
              <p className="mx-auto max-w-md font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-emerald-200/70">
                {dailyVerseRunDone
                  ? "Daily run completed. Keep reviewing for mastery."
                  : "Daily verse run active. Clear all targets to complete today."}
              </p>
            ) : null}
            {clusterGreekPreview ? (
              <p className="mx-auto max-w-3xl px-2 pt-1 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                Phrase focus
              </p>
            ) : null}
            <p className="mx-auto max-w-md px-1 text-[11px] leading-relaxed text-white/62">
              Tap words with status tags (new / seen / learned or done). Other words are context only.
            </p>
            {clusterGreekPreview ? (
              <p
                lang="el"
                className="mx-auto max-w-3xl border-b border-white/10 px-2 pb-3 pt-1 text-center text-sm leading-relaxed text-amber-200/85"
              >
                {clusterGreekPreview}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-center text-sm text-red-300/90">{error}</p> : null}
          </div>

          <section className="relative isolate z-0 w-full shrink-0 py-2">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full max-w-3xl space-y-4"
                >
                  <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                    Loading verse…
                  </p>
                  <div className="space-y-4 animate-pulse">
                    <div className="h-10 rounded-xl bg-white/10" />
                    <div className="h-10 rounded-xl bg-white/10" />
                    <div className="h-10 rounded-xl bg-white/10" />
                  </div>
                </motion.div>
              ) : greekTokens.length > 0 ? (
                <motion.div
                  key={`${pilot.bookSlug}-${pilot.chapter}-${verse}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  lang="el"
                  className="mx-auto flex w-full max-w-4xl flex-wrap content-start justify-center gap-x-2 gap-y-5 text-center leading-[1.38] text-amber-100/95 sm:gap-x-2.5 sm:gap-y-6 md:max-w-5xl"
                  style={{
                    fontSize: "clamp(1.2rem, min(4.8vw, 2.65rem), 2.65rem)",
                  }}
                >
                  {greekTokens.map((tok, wi) => {
                    const key = wordFormKey(tok)
                    const memory = wordMemory[key]
                    const familiarity = memory?.familiarity ?? "new"
                    const weakWord = weakWordSet.has(key)
                    const targetWord = questTargetIndexes.includes(wi)
                    const inPhraseCluster =
                      questCluster != null && wi >= questCluster.start && wi <= questCluster.end
                    const completedWord = completedTargetIndexes.includes(wi)
                    const selected = selectedWordIndex === wi
                    const hint = wordHintsEnabled ? getMorphHintAbbrev(tok) : null
                    return (
                      <span
                        key={`${verse}-${wi}-${tok.word}`}
                        className="inline-flex min-h-[3rem] max-w-[min(100%,18rem)] flex-col items-center justify-end gap-1 px-1 sm:min-h-[3.25rem]"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectGreekWord(wi)}
                          disabled={!targetWord}
                          className={
                            selected
                              ? "border-b-2 border-amber-300/85 pb-px text-amber-200"
                              : !targetWord
                                ? inPhraseCluster
                                  ? "border-b border-dotted border-white/25 pb-px text-amber-100/55"
                                  : "border-b border-transparent pb-px text-amber-100/35"
                                : weakWord
                                  ? "border-b border-dashed border-cyan-300/80 pb-px text-cyan-100 hover:border-cyan-200 hover:text-cyan-50"
                                  : familiarity === "learned"
                                    ? "border-b border-dashed border-emerald-300/70 pb-px text-emerald-100 hover:border-emerald-200 hover:text-emerald-50"
                                    : "border-b border-dashed border-amber-300/55 pb-px text-amber-100/95 hover:border-amber-300/80 hover:text-amber-50"
                          }
                        >
                          {tok.word}
                        </button>
                        {targetWord ? (
                          <span className="max-w-[8.5rem] text-center font-mono text-[8px] leading-tight text-white/55 sm:max-w-none sm:text-[9px]">
                            {completedWord ? "done" : familiarity}
                          </span>
                        ) : null}
                        {hint ? (
                          <span className="max-w-[9rem] text-center font-mono text-[9px] leading-tight text-amber-400/75 sm:max-w-[11rem] sm:text-[10px]">
                            {hint}
                          </span>
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
            <div className="mx-auto max-w-3xl shrink-0 border-t border-white/10 pt-5">
              <p
                className="text-center text-balance text-white/75 leading-relaxed"
                style={{ fontSize: "clamp(1rem, 3vw, 1.45rem)" }}
              >
                {english}
              </p>
            </div>
          ) : null}
        </div>
      </main>

      <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto border-l border-white/10 bg-black/25 px-3 py-4 lg:flex lg:max-h-full">
        {!selectedToken ? (
          <p className="text-xs leading-relaxed text-white/55">
            Select a target word in the verse. On desktop, quizzes, results, morphology, and coach stay in this
            column—no bottom sheet.
          </p>
        ) : (
          <>
            <div className="sticky top-0 z-[1] -mx-3 -mt-4 mb-1 flex items-center justify-between gap-2 border-b border-white/10 bg-[#060b14]/90 px-3 py-2 backdrop-blur-md">
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Verse Quest · Word</p>
                <p className="truncate text-sm text-white/90" lang="el">
                  {selectedToken.word}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white/70 hover:bg-white/[0.12]"
                aria-label="Close word panel"
              >
                <X className="size-4" />
              </button>
            </div>

            {questStage === "challenge" && questChallenge?.targetIndex === selectedWordIndex ? (
              <div className="rounded-xl border border-cyan-300/30 bg-cyan-400/[0.08] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100/85">Quick challenge</p>
                <p className="mt-1 text-sm text-white/85">{questChallenge.prompt}</p>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {questChallenge.options.map((option, idx) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => revealQuestWord(idx === questChallenge.correctOptionIndex, { chosenIndex: idx })}
                      className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-left text-sm text-white/88 hover:bg-black/45 active:scale-[0.99]"
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => revealQuestWord(false, { skipped: true })}
                  className="mt-2 rounded-lg border border-white/20 bg-white/[0.03] px-3 py-1.5 text-xs text-white/72 hover:bg-white/[0.08]"
                >
                  Reveal without guessing
                </button>
              </div>
            ) : null}

            {questStage === "challenge" ? (
              <MorphologySidebarPanel
                token={selectedToken}
                verseNumber={verse}
                wordIndex={selectedWordIndex ?? 0}
              />
            ) : null}

            {questStage === "revealed" && questQuizFeedback ? (
              <div className="space-y-3">
                {questQuizFeedback.outcome === "correct" ? (
                  <div className="rounded-xl border border-emerald-400/45 bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 p-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-200" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/95">Correct</p>
                        <p className="mt-1 text-base font-medium text-white">Nice work.</p>
                        <p className="mt-1 text-xs text-white/75">
                          +{questQuizFeedback.xpGained} XP · {questQuizFeedback.prompt}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : questQuizFeedback.outcome === "incorrect" ? (
                  <div className="rounded-xl border border-rose-400/40 bg-gradient-to-br from-rose-500/20 to-rose-950/30 p-3">
                    <div className="flex items-start gap-2.5">
                      <XCircle className="mt-0.5 size-6 shrink-0 text-rose-200" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rose-100/90">Not quite</p>
                        <p className="mt-1 text-sm text-white/92">
                          Correct answer:{" "}
                          <span className="font-medium text-rose-50">{questQuizFeedback.correctAnswer}</span>
                        </p>
                        {questQuizFeedback.chosenAnswer &&
                        questQuizFeedback.chosenAnswer !== questQuizFeedback.correctAnswer ? (
                          <p className="mt-1 text-xs text-white/65">
                            Your choice: <span className="text-white/85">{questQuizFeedback.chosenAnswer}</span>
                          </p>
                        ) : null}
                        <p className="mt-1.5 text-[11px] text-white/55">{questQuizFeedback.prompt}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-sky-400/35 bg-gradient-to-br from-sky-500/15 to-slate-900/40 p-3">
                    <div className="flex items-start gap-2.5">
                      <Eye className="mt-0.5 size-6 shrink-0 text-sky-200" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-100/85">Revealed</p>
                        <p className="mt-1 text-sm text-white/90">
                          Answer: <span className="font-medium text-sky-50">{questQuizFeedback.correctAnswer}</span>
                        </p>
                        <p className="mt-1.5 text-[11px] text-white/55">{questQuizFeedback.prompt}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {questStage === "revealed" ? (
              <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/[0.08] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100/85">Word memory</p>
                <p className="mt-1 text-sm text-white/92">
                  Familiarity: <span className="text-emerald-100">{selectedFamiliarityLabel}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-white/75">
                  {selectedTokenLearningClues?.quickReason ??
                    `Lemma ${selectedToken.lemma} · parse ${selectedToken.parse}`}
                </p>
              </div>
            ) : null}

            {questStage === "revealed" ? (
              <div className="flex flex-col gap-4">
                <div className={greekCoachQuizContext ? "order-1" : "order-2"}>
                  <GreekCoachLab
                    key={`${levelKey}-aside-lab-${selectedWordIndex}`}
                    levelKey={levelKey}
                    passageRef={passageRef}
                    english={english}
                    verseGreekLine={verseGreekLine}
                    selectedToken={selectedToken}
                    wordIndex={selectedWordIndex ?? 0}
                    learningClues={selectedTokenLearningClues}
                    awardProgress={awardProgress}
                    quizContext={greekCoachQuizContext}
                    className="mt-0"
                  />
                </div>
                <div className={greekCoachQuizContext ? "order-2" : "order-1"}>
                  <MorphologySidebarPanel
                    token={selectedToken}
                    verseNumber={verse}
                    wordIndex={selectedWordIndex ?? 0}
                  />
                </div>
              </div>
            ) : null}

            {questStage === "revealed" ? (
              <button
                type="button"
                onClick={continueQuest}
                className="w-full rounded-lg border border-emerald-300/40 bg-emerald-400/20 px-3 py-2.5 text-xs text-emerald-50 hover:bg-emerald-400/30"
              >
                Continue quest
              </button>
            ) : null}
          </>
        )}
      </aside>
      </div>

      <AnimatePresence>
        {selectedToken ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[66] flex min-h-0 items-end lg:hidden"
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
              className="relative z-[67] flex w-full max-h-[min(72dvh,640px)] flex-col overflow-hidden rounded-t-3xl border-t border-white/20 bg-[#060b14]/95"
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
              onPointerDown={onDetailPointerDown}
              onPointerMove={onDetailPointerMove}
              onPointerUp={onDetailPointerUp}
              onPointerCancel={onDetailPointerUp}
            >
              <div
                className="shrink-0 border-b border-white/10 px-4 pb-3 pt-3 sm:px-6"
              >
                <div
                  data-detail-swipe-handle
                  className="mb-2 flex flex-col items-center gap-1.5 pb-1 text-center select-none"
                  onTouchStart={onDetailHandleTouchStart}
                  onTouchMove={onDetailHandleTouchMove}
                  onTouchEnd={onDetailHandleTouchEnd}
                  onTouchCancel={() => {
                    detailHandleSwipeStartY.current = null
                  }}
                >
                  <div className="h-1.5 w-14 rounded-full bg-white/25" />
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Swipe down from here to close</p>
                </div>
                <div className="mx-auto flex max-w-4xl items-center justify-between">
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
              </div>
              <div
                ref={detailContentRef}
                className="mx-auto flex min-h-0 w-full max-w-4xl max-h-[calc(min(72dvh,640px)-9.25rem)] flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-2 [-webkit-overflow-scrolling:touch] sm:px-6"
              >
                {questStage === "challenge" && questChallenge?.targetIndex === selectedWordIndex ? (
                  <div className="rounded-xl border border-cyan-300/30 bg-cyan-400/[0.08] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100/85">Quick challenge</p>
                    <p className="mt-1 text-sm text-white/85">{questChallenge.prompt}</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {questChallenge.options.map((option, idx) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            revealQuestWord(idx === questChallenge.correctOptionIndex, { chosenIndex: idx })
                          }
                          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-left text-sm text-white/88 hover:bg-black/45 active:scale-[0.99]"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => revealQuestWord(false, { skipped: true })}
                      className="mt-2 rounded-lg border border-white/20 bg-white/[0.03] px-3 py-1.5 text-xs text-white/72 hover:bg-white/[0.08]"
                    >
                      Reveal without guessing
                    </button>
                  </div>
                ) : null}

                {questStage === "revealed" && questQuizFeedback ? (
                  <AnimatePresence mode="wait">
                    {questQuizFeedback.outcome === "correct" ? (
                      <motion.div
                        key="fb-correct"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: "spring", damping: 26, stiffness: 380 }}
                        className="rounded-xl border border-emerald-400/45 bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 p-3 shadow-[0_0_24px_-8px_rgba(52,211,153,0.45)]"
                      >
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-200" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/95">
                              Correct
                            </p>
                            <p className="mt-1 text-base font-medium text-white">Nice work.</p>
                            <p className="mt-1 text-xs text-white/75">
                              +{questQuizFeedback.xpGained} XP · {questQuizFeedback.prompt}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ) : questQuizFeedback.outcome === "incorrect" ? (
                      <motion.div
                        key="fb-wrong"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: "spring", damping: 26, stiffness: 380 }}
                        className="rounded-xl border border-rose-400/40 bg-gradient-to-br from-rose-500/20 to-rose-950/30 p-3 shadow-[0_0_22px_-8px_rgba(251,113,133,0.35)]"
                      >
                        <div className="flex items-start gap-2.5">
                          <XCircle className="mt-0.5 size-6 shrink-0 text-rose-200" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rose-100/90">
                              Not quite
                            </p>
                            <p className="mt-1 text-sm text-white/92">
                              Correct answer:{" "}
                              <span className="font-medium text-rose-50">{questQuizFeedback.correctAnswer}</span>
                            </p>
                            {questQuizFeedback.chosenAnswer &&
                            questQuizFeedback.chosenAnswer !== questQuizFeedback.correctAnswer ? (
                              <p className="mt-1 text-xs text-white/65">
                                Your choice:{" "}
                                <span className="text-white/85">{questQuizFeedback.chosenAnswer}</span>
                              </p>
                            ) : null}
                            <p className="mt-1.5 text-[11px] text-white/55">{questQuizFeedback.prompt}</p>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="fb-skip"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: "spring", damping: 26, stiffness: 380 }}
                        className="rounded-xl border border-sky-400/35 bg-gradient-to-br from-sky-500/15 to-slate-900/40 p-3"
                      >
                        <div className="flex items-start gap-2.5">
                          <Eye className="mt-0.5 size-6 shrink-0 text-sky-200" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-100/85">
                              Revealed
                            </p>
                            <p className="mt-1 text-sm text-white/90">
                              Answer:{" "}
                              <span className="font-medium text-sky-50">{questQuizFeedback.correctAnswer}</span>
                            </p>
                            <p className="mt-1.5 text-[11px] text-white/55">{questQuizFeedback.prompt}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ) : null}

                {questStage === "revealed" ? (
                  <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/[0.08] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100/85">Word memory</p>
                    <p className="mt-1 text-sm text-white/92">
                      Familiarity: <span className="text-emerald-100">{selectedFamiliarityLabel}</span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/75">
                      {selectedTokenLearningClues?.quickReason ??
                        `Lemma ${selectedToken.lemma} · parse ${selectedToken.parse}`}
                    </p>
                  </div>
                ) : null}

                {questStage === "revealed" ? (
                  <div className="flex flex-col gap-4">
                    <div className={greekCoachQuizContext ? "order-1" : "order-2"}>
                      <GreekCoachLab
                        key={`${levelKey}-lab-${selectedWordIndex}`}
                        levelKey={levelKey}
                        passageRef={passageRef}
                        english={english}
                        verseGreekLine={verseGreekLine}
                        selectedToken={selectedToken}
                        wordIndex={selectedWordIndex ?? 0}
                        learningClues={selectedTokenLearningClues}
                        awardProgress={awardProgress}
                        quizContext={greekCoachQuizContext}
                        className="mt-0"
                      />
                    </div>
                    <div className={greekCoachQuizContext ? "order-2" : "order-1"}>
                      <MorphologySidebarPanel
                        token={selectedToken}
                        verseNumber={verse}
                        wordIndex={selectedWordIndex ?? 0}
                      />
                    </div>
                  </div>
                ) : (
                  <MorphologySidebarPanel
                    token={selectedToken}
                    verseNumber={verse}
                    wordIndex={selectedWordIndex ?? 0}
                  />
                )}

                {questStage === "revealed" ? (
                  <>
                    <button
                      type="button"
                      onClick={continueQuest}
                      className="w-full rounded-lg border border-emerald-300/40 bg-emerald-400/20 px-3 py-2.5 text-xs text-emerald-50 hover:bg-emerald-400/30"
                    >
                      Continue quest
                    </button>
                  </>
                ) : null}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <footer className="relative z-[62] shrink-0 border-t border-white/10 bg-black/30 backdrop-blur-xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
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
          Word study &amp; grammar in full chapter
          <ExternalLink className="size-3.5 opacity-80" />
        </Link>
      </footer>
    </div>
  )
}
