"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Menu,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { MorphologySidebarPanel } from "@/app/bible/_components/morphology-sidebar"
import { getMorphHintAbbrev } from "@/lib/bible/greek-morph-hints"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { expandGreekMorphToken } from "@/lib/bible/robinson-greek"
import { buildGreekWordLearningClues } from "@/lib/bible/greek-word-learning-clues"
import {
  getGreekProgressSnapshot,
  getGreekStudyProgress,
  recordGreekStudyEvent,
  type GreekProgressSnapshot,
} from "@/lib/devotions-greek-progress"
import {
  MORPH_PILOT_CHAPTERS,
  morphPilotPassageRef,
  morphPilotReaderUrl,
  type MorphPilotChapterMenuItem,
} from "@/lib/bible/morph-pilot-menu"
import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"

const STORAGE_KEY = "fx_devotions_greek_place_v1"
const MENU_SWIPE_CLOSE_THRESHOLD = 72
const DETAIL_SWIPE_CLOSE_THRESHOLD = 102
const DETAIL_SWIPE_CLOSE_VELOCITY = 0.72
const GREEK_PAGE_KEY = "fx_devotions_greek_v1_page"
const SESSION_XP = 14
const VERSE_XP = 8
const WORD_XP = 12
const COACH_XP = 20

type StoredPlace = { bookSlug: string; chapter: number; verse: number }
type PassageVerse = { number: number; text: string }
type GreekCoachPayload = { insight: string; prayerPrompt: string }
type GreekStudioPage = "xp-home" | "study" | "progress"

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

export function GreekOneVerseClient() {
  const [page, setPage] = useState<GreekStudioPage>("xp-home")
  const [pilotIdx, setPilotIdx] = useState(0)
  const [verse, setVerse] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [verseDraft, setVerseDraft] = useState("1")
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [english, setEnglish] = useState("")
  const [greekTokens, setGreekTokens] = useState<GreekMorphToken[]>([])
  const [wordHintsEnabled, setWordHintsEnabled] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [coachPayload, setCoachPayload] = useState<GreekCoachPayload | null>(null)
  const [coachTokenKey, setCoachTokenKey] = useState<string | null>(null)
  const [coachQuestion, setCoachQuestion] = useState("")
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
  const verseProgress = `${Math.max(3, (verse / pilot.maxVerse) * 100)}%`

  const verseSwipeStartX = useRef<number | null>(null)
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

  const awardProgress = useCallback(
    (event: Parameters<typeof recordGreekStudyEvent>[0]) => {
      const { progress: updated, awardedXp } = recordGreekStudyEvent(event)
      setProgress(getGreekProgressSnapshot(updated))
      if (awardedXp > 0) {
        setXpBurst(awardedXp)
      }
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
      if (!e.key || e.key === "fx_devotions_greek_v1_progress") {
        refreshProgress()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refreshProgress])

  useEffect(() => {
    if (xpBurst == null) return
    const t = window.setTimeout(() => setXpBurst(null), 1300)
    return () => window.clearTimeout(t)
  }, [xpBurst])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(GREEK_PAGE_KEY)
    if (stored === "study" || stored === "progress" || stored === "xp-home") {
      setPage(stored as GreekStudioPage)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(GREEK_PAGE_KEY, page)
  }, [page])

  useEffect(() => {
    if (!hydrated) return
    savePlace({ bookSlug: pilot.bookSlug, chapter: pilot.chapter, verse })
  }, [hydrated, pilot.bookSlug, pilot.chapter, verse])

  useEffect(() => {
    setVerseDraft(String(verse))
  }, [verse])

  useEffect(() => {
    if (!hydrated) return
    if (initializedDailySession.current) return
    initializedDailySession.current = true
    awardProgress({ kind: "session", key: "daily-open", xp: SESSION_XP })
    setPage("xp-home")
  }, [hydrated, awardProgress])

  useEffect(() => {
    if (!hydrated) return
    awardProgress({
      kind: "verse",
      key: `${pilot.bookSlug}-${pilot.chapter}-${verse}`,
      xp: VERSE_XP,
    })
  }, [hydrated, pilot.bookSlug, pilot.chapter, verse, awardProgress])

  useEffect(() => {
    if (!hydrated) return

    const controller = new AbortController()
    const ref = passageRef
    const t = FX_GREEK_GRAMMAR_TRANSLATION_KEY

    setLoading(true)
    setError(null)
    setSelectedWordIndex(null)

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
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [hydrated, passageRef, verse])

  const prevVerse = useCallback(() => {
    setVerse((v) => Math.max(1, v - 1))
  }, [])

  const nextVerse = useCallback(() => {
    setVerse((v) => Math.min(pilot.maxVerse, v + 1))
  }, [pilot.maxVerse])

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeDetails = useCallback(() => setSelectedWordIndex(null), [])

  useEffect(() => {
    if (selectedWordIndex == null) setDetailDragOffsetY(0)
  }, [selectedWordIndex])

  useEffect(() => {
    if (page !== "study") {
      setSelectedWordIndex(null)
    }
  }, [page])

  const selectPilot = useCallback((idx: number) => {
    setPilotIdx(idx)
    setVerse(1)
    closeMenu()
  }, [closeMenu])

  const jumpToVerse = useCallback(() => {
    const num = Number.parseInt(verseDraft.trim(), 10)
    if (!Number.isFinite(num)) return
    setVerse(Math.min(pilot.maxVerse, Math.max(1, num)))
    closeMenu()
  }, [pilot.maxVerse, verseDraft, closeMenu])

  const handleSelectGreekWord = useCallback((wordIndex: number) => {
    setSelectedWordIndex((prev) => (prev === wordIndex ? null : wordIndex))
  }, [])

  const onVerseTouchStart = useCallback((e: TouchEvent) => {
    verseSwipeStartX.current = e.changedTouches[0]?.clientX ?? null
  }, [])

  const onVerseTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (menuOpen || selectedWordIndex != null) return
      const start = verseSwipeStartX.current
      verseSwipeStartX.current = null
      if (start == null) return
      const end = e.changedTouches[0]?.clientX
      if (end == null) return
      const dx = end - start
      if (dx > 56) prevVerse()
      else if (dx < -56) nextVerse()
    },
    [menuOpen, selectedWordIndex, prevVerse, nextVerse],
  )

  const selectedToken =
    selectedWordIndex != null && selectedWordIndex >= 0 ? greekTokens[selectedWordIndex] ?? null : null
  const selectedTokenExpanded = selectedToken ? expandGreekMorphToken(selectedToken) : null
  const selectedTokenLearningClues = selectedToken ? buildGreekWordLearningClues(selectedToken) : null
  const defaultCoachQuestion = selectedTokenLearningClues?.articleFunctionHint
    ? "What is the article doing here?"
    : "Why is this form parsed this way?"

  const activeTokenKey =
    selectedToken && selectedWordIndex != null
      ? `${pilot.bookSlug}-${pilot.chapter}-${verse}-${selectedWordIndex}-${selectedToken.word}`
      : null
  const verseGreekContext = greekTokens.map((tok) => tok.word).join(" ")

  useEffect(() => {
    if (!activeTokenKey) {
      setCoachPayload(null)
      setCoachError(null)
      setCoachQuestion("")
      return
    }
    if (selectedToken) {
      awardProgress({
        kind: "word",
        key: activeTokenKey,
        xp: WORD_XP,
        wordFormKey: `${selectedToken.lemma}|${selectedToken.parse}`,
      })
    }
    if (coachTokenKey?.startsWith(`${activeTokenKey}|`)) return
    setCoachPayload(null)
    setCoachError(null)
    setCoachQuestion("")
  }, [activeTokenKey, coachTokenKey, selectedToken, awardProgress])

  const runAiCoach = useCallback(async (explicitQuestion?: string) => {
    if (!selectedToken || !activeTokenKey) return
    if (coachLoading) return
    const resolvedQuestion = (explicitQuestion ?? coachQuestion).trim()
    const requestKey = `${activeTokenKey}|${resolvedQuestion.toLowerCase()}`
    if (coachTokenKey === requestKey && coachPayload) return

    setCoachLoading(true)
    setCoachError(null)
    try {
      const response = await fetch("/api/devotions/greek-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: passageRef,
          greekWord: selectedToken.word,
          lemma: selectedToken.lemma,
          parse: selectedToken.parse,
          category: selectedTokenExpanded?.posLabel ?? selectedToken.pos,
          parseSummary: selectedTokenExpanded?.parseSummary ?? selectedToken.parse,
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
        throw new Error(data?.error || "Could not generate AI coach insight.")
      }
      setCoachPayload({
        insight: insight.trim(),
        prayerPrompt: prayerPrompt.trim(),
      })
      setCoachTokenKey(requestKey)
      awardProgress({
        kind: "coach",
        key: requestKey,
        xp: COACH_XP,
      })
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Could not generate AI coach insight.")
    } finally {
      setCoachLoading(false)
    }
  }, [
    selectedToken,
    selectedTokenExpanded,
    activeTokenKey,
    coachLoading,
    coachTokenKey,
    coachPayload,
    passageRef,
    english,
    verseGreekContext,
    coachQuestion,
    awardProgress,
  ])

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

  const onDetailTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
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
  }, [detailDragOffsetY])

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

  const dailyXpPct = Math.max(0, Math.min(100, (progress.todayXp / progress.dailyGoalXp) * 100))
  return (
    <div className="fixed inset-0 z-[60] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#172033,transparent_44%),linear-gradient(to_bottom,#05070f,#030407,#010103)] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <motion.div
          className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl"
          animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
          transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-blue-300/10 blur-3xl"
          animate={{ opacity: [0.3, 0.58, 0.3], scale: [1, 1.06, 1] }}
          transition={{ duration: 8.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
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
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300/70">Greek Studio</p>
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
        <div className="px-4 pb-2 sm:px-8 md:px-14">
          <div className="mx-auto max-w-5xl">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/12">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-300/85 via-emerald-300/90 to-cyan-300/80"
                style={{ width: `${dailyXpPct}%` }}
                animate={xpBurst != null ? { filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"] } : undefined}
                transition={xpBurst != null ? { duration: 0.4 } : undefined}
              />
            </div>
          </div>
        </div>
        <div className="px-4 pb-3 sm:px-8 md:px-14">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            {(
              [
                ["xp-home", "XP"],
                ["study", "Study"],
                ["progress", "Progress"],
              ] as const
            ).map(([value, label]) => {
              const active = page === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPage(value)}
                  className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                    active
                      ? "border-emerald-300/55 bg-emerald-400/20 text-emerald-100"
                      : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  {label}
                </button>
              )
            })}
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
            className="pointer-events-none absolute right-4 top-[max(3.5rem,calc(env(safe-area-inset-top)+3rem))] z-[74] rounded-full border border-emerald-300/50 bg-emerald-400/25 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-50 shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
          >
            +{xpBurst} XP
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
              className="mx-auto w-full max-w-2xl rounded-3xl border border-white/20 bg-[#0a1020]/95 p-4 sm:p-5 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
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
                Study controls
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MORPH_PILOT_CHAPTERS.map((c, idx) => {
                  const active = idx === pilotIdx
                  return (
                    <button
                      key={`${c.bookSlug}-${c.chapter}`}
                      type="button"
                      onClick={() => selectPilot(idx)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-emerald-300/55 bg-emerald-400/20 text-emerald-100"
                          : "border-white/15 bg-white/[0.03] text-white/75 hover:bg-white/[0.08]"
                      }`}
                    >
                      <p className="font-sans text-sm font-medium">{c.label}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
                        {c.maxVerse} verses
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/25 p-3 sm:p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Jump to verse</p>
                <div className="flex gap-2">
                  <input
                    value={verseDraft}
                    onChange={(e) => setVerseDraft(e.target.value)}
                    inputMode="numeric"
                    className="flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2 font-mono text-sm text-white placeholder:text-white/35 focus:border-emerald-300/50 focus:outline-none"
                    placeholder={`1-${pilot.maxVerse}`}
                    aria-label="Verse number"
                  />
                  <button
                    type="button"
                    onClick={jumpToVerse}
                    className="rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-4 font-mono text-xs uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-400/25"
                  >
                    Go
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
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
          {page === "xp-home" ? (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26 }}
              className="rounded-2xl border border-white/15 bg-black/30 p-3 sm:p-4 space-y-3 backdrop-blur-md"
              aria-label="Greek study progression home"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1">
                  <Trophy className="size-3.5 text-emerald-100" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                    Level {progress.level}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Total XP</p>
                  <p className="text-sm font-semibold text-white/90">{progress.totalXp}</p>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-mono uppercase tracking-[0.14em] text-white/50">
                    <Zap className="mr-1 inline size-3.5 text-amber-200/80" />
                    Today {progress.todayXp}/{progress.dailyGoalXp} XP
                  </span>
                  <span className={`font-mono uppercase tracking-[0.14em] ${progress.dailyGoalReached ? "text-emerald-200/90" : "text-white/45"}`}>
                    {progress.dailyGoalReached ? "Goal reached" : "Daily goal"}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300/80 via-emerald-300/85 to-emerald-200/90 transition-[width] duration-300"
                    style={{ width: `${dailyXpPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Streak</p>
                  <p className="mt-0.5 text-sm font-semibold text-white/90">
                    <Flame className="mr-1 inline size-3.5 text-orange-300/90" />
                    {progress.streak}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Verses</p>
                  <p className="mt-0.5 text-sm font-semibold text-white/90">{progress.versesToday}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Words</p>
                  <p className="mt-0.5 text-sm font-semibold text-white/90">{progress.wordsToday}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Coach</p>
                  <p className="mt-0.5 text-sm font-semibold text-white/90">
                    <Target className="mr-1 inline size-3.5 text-cyan-200/85" />
                    {progress.coachToday}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-white/55">
                Start here daily, then move to Study and Progress pages.
              </p>
              <button
                type="button"
                onClick={() => setPage("study")}
                className="w-full rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-400/25 sm:w-auto"
              >
                Start study
              </button>
            </motion.section>
          ) : null}

          {page === "study" ? (
            <>
              <div className="space-y-2 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300/75">
                  {passageRef.replace(":", " · ")}
                </p>
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
                        const selected = selectedWordIndex === wi
                        const hint = wordHintsEnabled ? getMorphHintAbbrev(tok) : null
                        return (
                          <span key={`${verse}-${wi}-${tok.word}`} className="inline-flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => handleSelectGreekWord(wi)}
                              className={
                                selected
                                  ? "border-b-2 border-amber-300/85 text-amber-200"
                                  : "border-b border-dashed border-amber-300/35 text-amber-100/95 hover:border-amber-300/70 hover:text-amber-50"
                              }
                            >
                              {tok.word}
                            </button>
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
            </>
          ) : null}

          {page === "progress" ? (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/15 bg-black/35 p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-200/80">Progress detail</p>
                <span className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-100">
                  Level {progress.level}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Total XP</p>
                  <p className="mt-1 text-sm font-semibold text-white/92">{progress.totalXp}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Today XP</p>
                  <p className="mt-1 text-sm font-semibold text-white/92">
                    {progress.todayXp}/{progress.dailyGoalXp}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Streak</p>
                  <p className="mt-1 text-sm font-semibold text-white/92">{progress.streak} days</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Unique forms</p>
                  <p className="mt-1 text-sm font-semibold text-white/92">{progress.uniqueWordFormsToday}</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Today checklist</p>
                <ul className="mt-2 space-y-1.5 text-sm text-white/82">
                  <li>• Verses explored: {progress.versesToday}</li>
                  <li>• Words inspected: {progress.wordsToday}</li>
                  <li>• Coach asks: {progress.coachToday}</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setPage("study")}
                className="w-full rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-300/25 sm:w-auto"
              >
                Back to study
              </button>
            </motion.section>
          ) : null}

          {page === "study" && showEnglish && english ? (
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
              className="relative z-[67] w-full rounded-t-3xl border-t border-white/20 bg-[#060b14]/95 shadow-[0_-20px_60px_rgba(0,0,0,0.55)]"
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
              <div
                data-detail-swipe-handle
                className="mb-2 flex flex-col items-center gap-1.5 pb-1 text-center select-none"
              >
                <div className="h-1.5 w-14 rounded-full bg-white/25" />
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Swipe down from here to close</p>
              </div>
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Word details</p>
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

              <MorphologySidebarPanel
                token={selectedToken}
                verseNumber={verse}
                wordIndex={selectedWordIndex ?? 0}
              />

              {selectedTokenLearningClues ? (
                <div className="mt-3 rounded-xl border border-blue-300/25 bg-blue-400/[0.07] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-100/80">Why this form?</p>
                  {selectedTokenLearningClues.quickReason ? (
                    <p className="mt-2 text-sm text-white/90 leading-relaxed">{selectedTokenLearningClues.quickReason}</p>
                  ) : (
                    <p className="mt-2 text-sm text-white/70 leading-relaxed">
                      Parse template: <span className="font-mono text-white/85">{selectedTokenLearningClues.parseTemplate}</span>
                    </p>
                  )}
                  {selectedTokenLearningClues.slotClues.length > 0 ? (
                    <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-white/75">
                      {selectedTokenLearningClues.slotClues.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  {selectedTokenLearningClues.articleFunctionHint ? (
                    <p className="mt-2 text-xs text-blue-100/85 leading-relaxed">
                      Article note: {selectedTokenLearningClues.articleFunctionHint}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 rounded-2xl border border-emerald-300/25 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(3,14,20,0.55))] p-3 sm:p-4 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/85">AI Greek Coach</p>
                    <p className="mt-0.5 text-xs text-white/65">Ask about this exact form in this exact line.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runAiCoach()}
                    disabled={coachLoading}
                    className="rounded-full border border-emerald-300/45 bg-emerald-400/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-50 hover:bg-emerald-400/35 disabled:opacity-60"
                  >
                    {coachLoading ? "Thinking..." : "Coach me"}
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={coachQuestion}
                      onChange={(e) => setCoachQuestion(e.target.value)}
                      placeholder="Ask a Greek question in plain English..."
                      className="flex-1 rounded-xl border border-emerald-300/35 bg-black/35 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-emerald-200/60 focus:outline-none"
                      aria-label="Ask AI Greek coach a question"
                    />
                    <button
                      type="button"
                      onClick={() => void runAiCoach()}
                      disabled={coachLoading}
                      className="rounded-xl border border-emerald-300/45 bg-emerald-400/20 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-100 hover:bg-emerald-400/30 disabled:opacity-60"
                    >
                      Ask
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCoachQuestion(defaultCoachQuestion)
                        void runAiCoach(defaultCoachQuestion)
                      }}
                      disabled={coachLoading}
                      className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[11px] text-white/80 hover:bg-black/30 disabled:opacity-60"
                    >
                      {defaultCoachQuestion}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCoachQuestion("What role does this word play in the sentence?")
                        void runAiCoach("What role does this word play in the sentence?")
                      }}
                      disabled={coachLoading}
                      className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[11px] text-white/80 hover:bg-black/30 disabled:opacity-60"
                    >
                      What role is this word playing?
                    </button>
                  </div>
                </div>

                {coachError ? (
                  <p className="mt-3 rounded-lg border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-200/95">{coachError}</p>
                ) : null}
                {coachPayload ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 space-y-2 rounded-xl border border-emerald-200/25 bg-black/25 p-3"
                  >
                    <p className="text-sm leading-relaxed text-white/92">{coachPayload.insight}</p>
                    <p className="text-xs leading-relaxed text-emerald-100/95">{coachPayload.prayerPrompt}</p>
                  </motion.div>
                ) : !coachLoading && !coachError ? (
                  <p className="mt-3 text-xs text-white/62 leading-relaxed">
                    Tip: ask concrete questions like <span className="text-white/78">“Why dative?”</span> or{" "}
                    <span className="text-white/78">“What is this article doing?”</span>
                  </p>
                ) : null}
              </div>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {page === "study" ? (
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
      ) : null}
    </div>
  )
}
