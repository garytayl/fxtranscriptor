"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform, useDragControls, type PanInfo } from "framer-motion"
import {
  LogOut,
  MoreHorizontal,
  Download,
  Upload,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  PenLine,
  X,
  ChevronDown,
  Settings,
  Flame,
  Calendar,
} from "lucide-react"
import { getPassageEntry, savePassageEntry } from "@/lib/devotions-storage"
import { getDevotionsSettings, setShowTracking, setChaptersPerDay } from "@/lib/devotions-settings"
import {
  getDevotionsTracking,
  recordDevotionSession,
  sessionsThisWeek,
  currentStreak,
} from "@/lib/devotions-tracking"
import { getPassageRefForDate } from "@/lib/devotions-passages"
import { getSection, getPredefinedSections } from "@/lib/devotions-sections"
import {
  getReadingPlan,
  setReadingPlan as persistReadingPlan,
  clearReadingPlan,
  getNextChapter,
  advanceReadingPlan,
  type ReadingPlanState,
} from "@/lib/devotions-plan"
import { getReaderUrlFromReference } from "@/lib/bible/reference"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

const JOURNAL_SHEET_DISMISS_THRESHOLD = 60

const REFLECTION_PROMPTS = [
  "What line or phrase is staying with you?",
  "Where did you see yourself in this passage?",
  "One thing you want to carry from this into your day.",
  "What is this passage saying back to you?",
  "What do you want to remember from this?",
  "A word or image that fits how this lands.",
  "What are you sitting with after reading?",
]

function getReflectionPrompt(passageRef: string): string {
  const slug = passageRef.toLowerCase().replace(/\s/g, "").replace(/:/g, "")
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash << 5) - hash + slug.charCodeAt(i)
  const i = Math.abs(hash) % REFLECTION_PROMPTS.length
  return REFLECTION_PROMPTS[i] ?? REFLECTION_PROMPTS[0]
}

type JournalPanelProps = {
  passageRef: string
  prayer: string
  reflection: string
  onPrayerChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onReflectionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBlur: () => void
}

function JournalPanel({
  passageRef,
  prayer,
  reflection,
  onPrayerChange,
  onReflectionChange,
  onBlur,
}: JournalPanelProps) {
  const prompt = getReflectionPrompt(passageRef)
  return (
    <div className="space-y-5">
      <div>
        <label
          htmlFor="devotions-prayer"
          className="block font-sans text-sm font-light text-white/80 mb-1.5"
        >
          A prayer in your own words
        </label>
        <textarea
          id="devotions-prayer"
          value={prayer}
          onChange={onPrayerChange}
          onBlur={onBlur}
          placeholder="Whatever you want to say—or leave blank"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 font-sans text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/30 resize-y transition-colors"
        />
      </div>
      <div>
        <label
          htmlFor="devotions-reflection"
          className="block font-sans text-sm font-light text-white/80 mb-1.5"
        >
          {prompt}
        </label>
        <textarea
          id="devotions-reflection"
          value={reflection}
          onChange={onReflectionChange}
          onBlur={onBlur}
          placeholder="Just a line or two—or nothing"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 font-sans text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/30 resize-y transition-colors"
        />
      </div>
    </div>
  )
}

function MobileJournalSheet({
  onDismiss,
  children,
}: {
  onDismiss: () => void
  children: React.ReactNode
}) {
  const sheetY = useMotionValue(0)
  const backdropOpacity = useTransform(sheetY, [0, 300], [1, 0])
  const dragControls = useDragControls()

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > JOURNAL_SHEET_DISMISS_THRESHOLD || info.velocity.y > 300) {
        onDismiss()
      }
    },
    [onDismiss],
  )

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ opacity: backdropOpacity }}
        className="lg:hidden fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px]"
        onClick={onDismiss}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        style={{ y: sheetY }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.8 }}
        onDragEnd={handleDragEnd}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[71] bg-[#0a0a0a] border-t border-white/10 rounded-t-[20px] max-h-[75vh] flex flex-col shadow-[0_-4px_40px_rgba(0,0,0,0.5)]"
        data-lenis-prevent
      >
        <div
          className="shrink-0 flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="w-14 h-1.5 rounded-full bg-white/30 active:bg-white/50 transition-colors" />
        </div>
        <div
          className="shrink-0 px-5 pb-3 flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <p className="font-mono text-[11px] tracking-[0.2em] text-white/70 uppercase">
            Journal
          </p>
          <div onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/8 active:bg-white/15 transition-colors"
              aria-label="Close journal"
            >
              <X className="size-3.5 text-white/60" />
            </button>
          </div>
        </div>
        <div className="mx-5 h-px bg-white/8" />
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
        <div className="shrink-0 flex items-center justify-center gap-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
          <ChevronDown className="size-3 text-white/25" />
          <span className="font-mono text-[9px] tracking-widest text-white/25 uppercase">
            Drag down to close
          </span>
        </div>
      </motion.div>
    </>
  )
}

function MobileJournalPill({ onTap }: { onTap: () => void }) {
  return (
    <motion.button
      initial={{ y: 20, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      type="button"
      onClick={onTap}
      className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-[65] flex items-center gap-2 bg-[#1a1a1a] border border-white/15 rounded-full pl-3.5 pr-4 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
    >
      <PenLine className="w-4 h-4 text-white/80" />
      <span className="font-mono text-[11px] tracking-wider text-white/90 uppercase whitespace-nowrap">
        Journal
      </span>
    </motion.button>
  )
}

type PassageData = {
  reference: string
  verses: { number: number; text: string }[]
}

type BibleBook = { id: string; name: string; slug: string; testament?: string }
type BibleChapter = { id: string; number: number }

type Step = "landing" | "planPicker" | "testament" | "book" | "chapter" | "verses" | "reading" | "reflection"

const SAVE_DEBOUNCE_MS = 400

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -24 : 24, opacity: 0 }),
}

export function DevotionsClient() {
  const [step, setStep] = useState<Step>("landing")
  const [dir, setDir] = useState(0) // 1 = forward, -1 = back
  const [passage, setPassage] = useState<PassageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prayer, setPrayer] = useState("")
  const [reflection, setReflection] = useState("")
  const [moreOpen, setMoreOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [journalSheetOpen, setJournalSheetOpen] = useState(false)
  const [settings, setSettings] = useState(() => getDevotionsSettings())
  const [tracking, setTracking] = useState(() => getDevotionsTracking())
  const [readingPlan, setReadingPlanState] = useState<ReadingPlanState | null>(() => getReadingPlan())
  /** When we loaded a passage from a reading plan, track for progress + Next. */
  const [activePlanSession, setActivePlanSession] = useState<{
    bookId: string
    chapterNumber: number
    sectionLabel: string
    maxChapterInBook: number
  } | null>(null)
  /** Section meta for progress (total chapters, books) when in plan mode. */
  const [sectionMeta, setSectionMeta] = useState<{
    totalChapters: number
    books: { bookId: string; chapterCount: number }[]
  } | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [oldTestament, setOldTestament] = useState<BibleBook[]>([])
  const [newTestament, setNewTestament] = useState<BibleBook[]>([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [selectedTestament, setSelectedTestament] = useState<"old" | "new" | null>(null)
  const [chapters, setChapters] = useState<BibleChapter[]>([])
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [verseRange, setVerseRange] = useState("")
  const [chaptersLoading, setChaptersLoading] = useState(false)

  const passageRef = passage?.reference ?? ""
  const reduced = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    fetch("/api/bible/books")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || data.error) return
        setOldTestament(data.oldTestament ?? [])
        setNewTestament(data.newTestament ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBooksLoading(false) })
    return () => { cancelled = true }
  }, [])

  const books = selectedTestament === "old" ? oldTestament : selectedTestament === "new" ? newTestament : []
  const bookIdToName = useCallback(() => {
    const all: BibleBook[] = [...oldTestament, ...newTestament]
    return new Map(all.map((b) => [b.id, b.name]))
  }, [oldTestament, newTestament])

  useEffect(() => {
    if (!selectedBook) {
      setChapters([])
      setSelectedChapter(null)
      return
    }
    let cancelled = false
    setChaptersLoading(true)
    fetch(`/api/bible/book/${encodeURIComponent(selectedBook.id)}/chapters`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || data.error) return
        const list = (data.chapters ?? []) as BibleChapter[]
        setChapters(list.sort((a, b) => a.number - b.number))
        setSelectedChapter(null)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChaptersLoading(false) })
    return () => { cancelled = true }
  }, [selectedBook])

  useEffect(() => {
    const entry = getPassageEntry(passageRef)
    setPrayer(entry.prayer)
    setReflection(entry.reflection)
  }, [passageRef])

  useEffect(() => {
    if (step !== "reading") setJournalSheetOpen(false)
  }, [step])

  useEffect(() => {
    if (!activePlanSession || !readingPlan) {
      setSectionMeta(null)
      return
    }
    let cancelled = false
    fetch(`/api/bible/section/${encodeURIComponent(readingPlan.sectionId)}/meta`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || data.error) return
        setSectionMeta({
          totalChapters: data.totalChapters ?? 0,
          books: (data.books ?? []).map((b: { bookId: string; chapterCount: number }) => ({
            bookId: b.bookId,
            chapterCount: b.chapterCount ?? 0,
          })),
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activePlanSession, readingPlan?.sectionId])

  // Sync settings, tracking, and reading plan from storage
  useEffect(() => {
    setSettings(getDevotionsSettings())
    setTracking(getDevotionsTracking())
    setReadingPlanState(getReadingPlan())
  }, [settingsOpen, moreOpen, step])

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null
      savePassageEntry(passageRef, { prayer, reflection })
    }, SAVE_DEBOUNCE_MS)
  }, [passageRef, prayer, reflection])

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [])

  const buildRef = useCallback((verseOverride?: string): string | null => {
    if (!selectedBook || selectedChapter == null) return null
    const v = verseOverride !== undefined ? verseOverride : verseRange
    const versePart = v.trim() ? `:${v.trim()}` : ""
    return `${selectedBook.name} ${selectedChapter}${versePart}`
  }, [selectedBook, selectedChapter, verseRange])

  const loadPassage = useCallback((verseOverride?: string) => {
    setActivePlanSession(null)
    const ref = buildRef(verseOverride)
    if (!ref) return
    setLoading(true)
    setError(null)
    fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setPassage({ reference: data.reference, verses: data.verses ?? [] })
        setDir(1)
        setStep("reading")
        recordDevotionSession(data.reference, settings.showTracking)
        setTracking(getDevotionsTracking())
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load passage.")
        toast.error("Could not load passage")
      })
      .finally(() => setLoading(false))
  }, [buildRef, settings.showTracking])

  const loadFullChapter = useCallback(() => {
    loadPassage("")
  }, [loadPassage])

  const loadTodaysPassage = useCallback(() => {
    setActivePlanSession(null)
    const ref = getPassageRefForDate(new Date())
    if (!ref) return
    setLoading(true)
    setError(null)
    fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setPassage({ reference: data.reference, verses: data.verses ?? [] })
        setDir(1)
        setStep("reading")
        recordDevotionSession(data.reference, settings.showTracking)
        setTracking(getDevotionsTracking())
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load passage.")
        toast.error("Could not load passage")
      })
      .finally(() => setLoading(false))
  }, [settings.showTracking])

  /** Load a passage by book id + chapter (for reading plan). Uses bookIdToName for ref. */
  const loadPlanPassage = useCallback(
    (bookId: string, chapterNumber: number, sectionLabel: string) => {
      const name = bookIdToName().get(bookId) ?? bookId
      const ref = `${name} ${chapterNumber}`
      setLoading(true)
      setError(null)
      setActivePlanSession(null)
      fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error)
          setPassage({ reference: data.reference, verses: data.verses ?? [] })
          setDir(1)
          setStep("reading")
          recordDevotionSession(data.reference, settings.showTracking)
          setTracking(getDevotionsTracking())
          return fetch(`/api/bible/book/${encodeURIComponent(bookId)}/chapters`).then((r) => r.json())
        })
        .then((chaptersData) => {
          const chList = (chaptersData.chapters ?? []) as { number: number }[]
          const maxChapter = chList.length > 0 ? Math.max(...chList.map((c) => c.number)) : chapterNumber
          setActivePlanSession({
            bookId,
            chapterNumber,
            sectionLabel,
            maxChapterInBook: maxChapter,
          })
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Could not load passage.")
          toast.error("Could not load passage")
        })
        .finally(() => setLoading(false))
    },
    [bookIdToName, settings.showTracking]
  )

  /** Continue reading plan: load next chapter. */
  const continueReadingPlan = useCallback(() => {
    const plan = getReadingPlan()
    if (!plan) return
    const next = getNextChapter(plan)
    if (!next) return
    const section = getSection(plan.sectionId)
    if (!section) return
    loadPlanPassage(next.bookId, next.chapterNumber, section.label)
  }, [loadPlanPassage])

  /** Start a new reading plan and load first chapter. */
  const startReadingPlan = useCallback(
    (sectionId: string) => {
      const section = getSection(sectionId)
      if (!section || section.bookIds.length === 0) return
      const plan: ReadingPlanState = {
        sectionId,
        lastBookId: section.bookIds[0],
        lastChapter: 0,
        chaptersPerDay: settings.chaptersPerDay,
        startedAt: new Date().toISOString(),
      }
      persistReadingPlan(plan)
      setReadingPlanState(plan)
      loadPlanPassage(section.bookIds[0], 1, section.label)
    },
    [loadPlanPassage, settings.chaptersPerDay]
  )

  /** Advance plan after reading current chapter and go to next (or finish). */
  const advancePlanAndNext = useCallback(() => {
    const plan = getReadingPlan()
    if (!plan || !activePlanSession) return
    const nextPlan = advanceReadingPlan(
      plan,
      activePlanSession.bookId,
      activePlanSession.chapterNumber,
      activePlanSession.maxChapterInBook
    )
    if (nextPlan) {
      persistReadingPlan(nextPlan)
      setReadingPlanState(nextPlan)
      const next = getNextChapter(nextPlan)
      if (next) {
        const section = getSection(nextPlan.sectionId)
        if (section) loadPlanPassage(next.bookId, next.chapterNumber, section.label)
      } else {
        setActivePlanSession(null)
      }
    } else {
      clearReadingPlan()
      setReadingPlanState(null)
      setActivePlanSession(null)
      setPassage(null)
      setStep("landing")
      setDir(-1)
      toast.success("You finished this plan!")
    }
  }, [activePlanSession, loadPlanPassage])

  const goBack = useCallback(() => {
    setDir(-1)
    if (step === "landing") return
    if (step === "planPicker") setStep("landing")
    else if (step === "testament") setStep("landing")
    else if (step === "book") setStep("testament")
    else if (step === "chapter") setStep("book")
    else if (step === "verses") setStep("chapter")
    else if (step === "reading") setStep("verses")
    else if (step === "reflection") setStep("reading")
  }, [step])

  const goToBook = useCallback(() => {
    setStep("testament")
    setDir(-1)
    setError(null)
  }, [])

  const enterDevotions = useCallback(() => {
    setDir(1)
    setStep("testament")
  }, [])

  const openReflection = useCallback(() => {
    setJournalSheetOpen(false)
    setDir(1)
    setStep("reflection")
  }, [])

  const closeReflection = useCallback(() => {
    setDir(-1)
    setStep("reading")
  }, [])

  const handleTestamentPick = useCallback((t: "old" | "new") => {
    setSelectedTestament(t)
    setSelectedBook(null)
    setDir(1)
    setStep("book")
  }, [])

  const handleBookPick = useCallback((book: BibleBook) => {
    setSelectedBook(book)
    setDir(1)
    setStep("chapter")
  }, [])

  const handleChapterPick = useCallback((chapterNum: number) => {
    setSelectedChapter(chapterNum)
    setDir(1)
    setStep("verses")
  }, [])

  const handlePrayerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrayer(e.target.value)
    scheduleSave()
  }
  const handleReflectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReflection(e.target.value)
    scheduleSave()
  }

  const handleExport = useCallback(() => {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith("fx_devotions_v1")) keys.push(key)
    }
    const data: Record<string, string> = {}
    keys.forEach((k) => { const v = window.localStorage.getItem(k); if (v) data[k] = v })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `fx-devotions-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMoreOpen(false)
    toast.success("Backup downloaded (includes journal, settings & tracking)")
  }, [])

  const handleImport = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as Record<string, string>
          if (typeof data !== "object") throw new Error("Invalid")
          let count = 0
          Object.entries(data).forEach(([k, v]) => {
            if (k.startsWith("fx_devotions_v1") && typeof v === "string") {
              window.localStorage.setItem(k, v)
              count++
            }
          })
          setMoreOpen(false)
          setSettings(getDevotionsSettings())
          setTracking(getDevotionsTracking())
          if (passageRef) {
            const entry = getPassageEntry(passageRef)
            setPrayer(entry.prayer)
            setReflection(entry.reflection)
          }
          toast.success(`Restored ${count} entries (journal, settings & tracking)`)
        } catch { toast.error("Invalid backup file") }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [passageRef])

  const stagger = reduced ? 0.02 : 0.06

  return (
    <div className="fixed inset-0 z-[60] flex flex-col h-screen max-h-[100dvh] bg-[#050505] text-white overflow-x-hidden">
      {/* Header: back/leave + title + menu (reading only) */}
      <header className="shrink-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 min-h-[52px] sm:px-6 md:px-12 border-b border-white/5">
        <div className="min-w-[80px] flex justify-start">
          {step === "landing" || step === "testament" || step === "planPicker" ? (
            <Link
              href="/"
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
              aria-label="Leave devotions"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Leave</span>
            </Link>
          ) : step === "reflection" ? (
            <button
              type="button"
              onClick={closeReflection}
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
              aria-label="Back to passage"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Passage</span>
            </button>
          ) : step === "reading" ? (
            <Link
              href="/"
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
              aria-label="Leave devotions"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Leave</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
              aria-label="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
        </div>
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/40 truncate max-w-[45vw] text-center">
          {step === "landing" && "Devotions"}
          {step === "planPicker" && "Start a reading plan"}
          {step === "testament" && "Choose testament"}
          {step === "book" && "Choose book"}
          {step === "chapter" && "Choose chapter"}
          {step === "verses" && (selectedBook ? `${selectedBook.name} ${selectedChapter}` : "Read")}
          {step === "reading" && (passage?.reference ?? "Devotions")}
          {step === "reflection" && "Reflection"}
        </span>
        <div className="min-w-[80px] flex justify-end gap-1">
          {step === "landing" && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-[44px] px-2 flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/45 hover:text-white/70 rounded"
              aria-label="Devotions settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          {step === "reading" ? (
            <>
              <button
                type="button"
                onClick={() => setJournalSheetOpen(true)}
                className="lg:hidden min-h-[44px] px-3 flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/50 hover:text-white/80 rounded"
                aria-label="Quick journal"
              >
                <PenLine className="w-4 h-4" />
                Journal
              </button>
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-white/70 rounded"
                aria-label="Menu"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </>
          ) : step === "reflection" ? (
            <button
              type="button"
              onClick={closeReflection}
              className="lg:hidden min-h-[44px] px-3 font-mono text-[10px] tracking-wider text-white/50 hover:text-white/80 rounded"
              aria-label="Back to passage"
            >
              Done
            </button>
          ) : step !== "landing" ? (
            <span />
          ) : (
            <span />
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-behavior-y-auto touch-pan-y w-full pb-[env(safe-area-inset-bottom)]"
          style={{ WebkitOverflowScrolling: "touch" }}
          data-lenis-prevent
        >
          <AnimatePresence mode="wait" custom={dir}>
            {/* Step 0: Landing — Be still and know */}
            {step === "landing" && (
              <motion.div
                key="landing"
                custom={dir}
                initial="enter"
                animate="center"
                exit="exit"
                variants={slide}
                transition={{ duration: reduced ? 0.15 : 0.3 }}
                className="w-full min-h-full flex flex-col items-center justify-center px-4 py-8 sm:px-6 md:px-12 box-border"
              >
                <div className="w-full max-w-lg mx-auto text-center space-y-10 sm:space-y-12">
                  <motion.div
                    className="space-y-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduced ? 0 : 0.2, duration: 0.5 }}
                  >
                    <p className="font-sans text-2xl sm:text-3xl md:text-4xl font-light text-white/95 leading-snug tracking-tight">
                      Be still, and know that I am God.
                    </p>
                    <p className="font-mono text-[10px] tracking-[0.25em] text-white/50 uppercase">
                      Psalm 46:10
                    </p>
                  </motion.div>
                  <p className="font-sans text-base sm:text-lg text-white/70 font-light max-w-sm mx-auto">
                    Find the stillness. He is the Lord.
                  </p>
                  {settings.showTracking && (tracking.totalSessions > 0 || currentStreak(tracking) > 0) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center justify-center gap-6 font-mono text-[11px] tracking-wider text-white/50"
                    >
                      {currentStreak(tracking) > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-white/60" />
                          {currentStreak(tracking)} day{currentStreak(tracking) !== 1 ? "s" : ""} streak
                        </span>
                      )}
                      {sessionsThisWeek(tracking) > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-white/60" />
                          {sessionsThisWeek(tracking)} this week
                        </span>
                      )}
                    </motion.div>
                  )}
                  <div className="flex flex-col gap-3 sm:gap-4 pt-2">
                    {readingPlan && (
                      <button
                        type="button"
                        onClick={continueReadingPlan}
                        disabled={loading || booksLoading}
                        className="w-full min-h-[56px] rounded-xl font-sans text-lg font-light text-white/95 bg-white/15 border border-white/25 hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? "Loading…" : booksLoading ? "Preparing…" : `Continue in ${getSection(readingPlan.sectionId)?.label ?? readingPlan.sectionId}`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={loadTodaysPassage}
                      disabled={loading}
                      className="w-full min-h-[56px] rounded-xl font-sans text-lg font-light text-white/95 bg-white/10 border border-white/20 hover:bg-white/15 hover:border-white/30 transition-colors disabled:opacity-50"
                    >
                      {loading ? "Loading…" : "Today’s passage"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDir(1); setStep("planPicker"); }}
                      disabled={booksLoading}
                      className="w-full min-h-[52px] rounded-xl font-mono text-[11px] tracking-[0.2em] uppercase text-white/70 border border-white/15 hover:bg-white/10 hover:text-white/90 transition-colors disabled:opacity-50"
                    >
                      {booksLoading ? "Preparing…" : "Start a reading plan"}
                    </button>
                    <button
                      type="button"
                      onClick={enterDevotions}
                      className="w-full min-h-[52px] rounded-xl font-mono text-[11px] tracking-[0.2em] uppercase text-white/70 border border-white/15 hover:bg-white/10 hover:text-white/90 transition-colors"
                    >
                      Choose a passage
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step: Plan picker — choose section */}
            {step === "planPicker" && (
              <motion.div
                key="planPicker"
                custom={dir}
                initial="enter"
                animate="center"
                exit="exit"
                variants={slide}
                transition={{ duration: reduced ? 0.15 : 0.25 }}
                className="w-full px-4 py-6 sm:px-6 md:px-12 md:py-12 lg:py-16 pb-12 box-border"
              >
                <div className="w-full max-w-lg md:max-w-2xl mx-auto md:rounded-2xl md:border md:border-white/10 md:bg-white/[0.02] md:px-10 md:py-10 lg:px-12 lg:py-12">
                  <p className="font-sans text-xl sm:text-2xl md:text-3xl font-light text-white/90 mb-2">
                    Read through a section
                  </p>
                  <p className="font-mono text-[10px] tracking-wider text-white/50 mb-6 sm:mb-8">
                    Pick up where you left off each time.
                  </p>
                  <ul className="space-y-0 md:max-h-[50vh] md:overflow-y-auto md:pr-1">
                    {getPredefinedSections().map((sec) => (
                      <li key={sec.id}>
                        <button
                          type="button"
                          onClick={() => startReadingPlan(sec.id)}
                          disabled={loading || booksLoading}
                          className="w-full flex items-center justify-between py-4 sm:py-5 text-left border-b border-white/10 font-sans text-base sm:text-lg text-white/90 hover:text-white hover:bg-white/5 transition-colors min-h-[56px] disabled:opacity-50"
                        >
                          <span>{sec.label}</span>
                          <span className="font-mono text-[10px] text-white/45">{sec.bookIds.length} book{sec.bookIds.length !== 1 ? "s" : ""}</span>
                          <ChevronRight className="w-5 h-5 text-white/40 shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}

            {/* Step 1: Old or New Testament? */}
            {step === "testament" && (
              <motion.div
                key="testament"
                custom={dir}
                initial="enter"
                animate="center"
                exit="exit"
                variants={slide}
                transition={{ duration: reduced ? 0.15 : 0.25 }}
                className="w-full px-4 py-6 sm:px-6 md:px-12 md:py-12 lg:py-16 box-border"
              >
                <div className="w-full max-w-lg md:max-w-2xl mx-auto md:rounded-2xl md:border md:border-white/10 md:bg-white/[0.02] md:px-10 md:py-10 lg:px-12 lg:py-12">
                  <p className="font-mono text-[10px] tracking-[0.2em] text-white/50 uppercase mb-3">
                    The Law and the Prophets · The Gospels and the Letters
                  </p>
                  <p className="font-sans text-xl sm:text-2xl md:text-3xl font-light text-white/90 mb-8 sm:mb-10">
                    Where would you like to read?
                  </p>
                  <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
                    <button
                      type="button"
                      onClick={() => handleTestamentPick("old")}
                      disabled={booksLoading}
                      className="w-full lg:flex-1 min-h-[64px] rounded-xl font-sans text-lg text-white/90 border border-white/20 hover:bg-white/10 hover:border-white/30 transition-colors text-left px-6 disabled:opacity-50"
                    >
                      Old Testament
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestamentPick("new")}
                      disabled={booksLoading}
                      className="w-full lg:flex-1 min-h-[64px] rounded-xl font-sans text-lg text-white/90 border border-white/20 hover:bg-white/10 hover:border-white/30 transition-colors text-left px-6 disabled:opacity-50"
                    >
                      New Testament
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: What book? */}
            {step === "book" && (
              <motion.div
                key="book"
                custom={dir}
                initial="enter"
                animate="center"
                exit="exit"
                variants={slide}
                transition={{ duration: reduced ? 0.15 : 0.25 }}
                className="w-full px-4 py-6 sm:px-6 md:px-12 md:py-12 lg:py-16 pb-12 box-border"
              >
                <div className="w-full max-w-lg md:max-w-2xl mx-auto md:rounded-2xl md:border md:border-white/10 md:bg-white/[0.02] md:px-10 md:py-10 lg:px-12 lg:py-12">
                  <p className="font-sans text-xl sm:text-2xl md:text-3xl font-light text-white/90 mb-6 sm:mb-8">
                    Which book speaks to you today?
                  </p>
                  {booksLoading ? (
                    <p className="font-mono text-xs tracking-wider text-white/50">Loading…</p>
                  ) : (
                    <ul className="space-y-0 md:max-h-[60vh] md:overflow-y-auto md:pr-1">
                      {books.map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => handleBookPick(b)}
                            className="w-full flex items-center justify-between py-4 sm:py-5 text-left border-b border-white/10 font-sans text-base sm:text-lg text-white/90 hover:text-white hover:bg-white/5 transition-colors min-h-[56px]"
                          >
                            <span>{b.name}</span>
                            <ChevronRight className="w-5 h-5 text-white/40 shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Which chapter? */}
            {step === "chapter" && selectedBook && (
              <motion.div
                key="chapter"
                custom={dir}
                initial="enter"
                animate="center"
                exit="exit"
                variants={slide}
                transition={{ duration: reduced ? 0.15 : 0.25 }}
                className="w-full px-4 py-6 sm:px-6 md:px-12 md:py-12 lg:py-16 pb-12 box-border"
              >
                <div className="w-full max-w-2xl md:max-w-3xl mx-auto md:rounded-2xl md:border md:border-white/10 md:bg-white/[0.02] md:px-10 md:py-10 lg:px-12 lg:py-12">
                  <p className="font-sans text-xl sm:text-2xl md:text-3xl font-light text-white/90 mb-2">
                    Sit with a chapter
                  </p>
                  <p className="font-mono text-[10px] tracking-wider text-white/50 mb-6 sm:mb-8">
                    {selectedBook.name}
                  </p>
                  {chaptersLoading ? (
                    <p className="font-mono text-xs tracking-wider text-white/50">Loading…</p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-3">
                      {chapters.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => handleChapterPick(ch.number)}
                          className="min-h-[52px] sm:min-h-[56px] rounded-lg font-sans text-lg sm:text-xl text-white/90 border border-white/15 hover:bg-white/10 hover:border-white/25 hover:text-white transition-colors"
                        >
                          {ch.number}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          {/* Step 4: Read full chapter or verses */}
          {step === "verses" && selectedBook && selectedChapter != null && (
            <motion.div
              key="verses"
              custom={dir}
              initial="enter"
              animate="center"
              exit="exit"
              variants={slide}
              transition={{ duration: reduced ? 0.15 : 0.25 }}
              className="w-full px-4 py-6 sm:px-6 md:px-12 md:py-12 lg:py-16 pb-12 box-border"
            >
              <div className="w-full max-w-lg md:max-w-2xl mx-auto md:rounded-2xl md:border md:border-white/10 md:bg-white/[0.02] md:px-10 md:py-10 lg:px-12 lg:py-12">
                <p className="font-sans text-xl sm:text-2xl md:text-3xl font-light text-white/90 mb-2">
                  Read this
                </p>
                <p className="font-mono text-[10px] tracking-wider text-white/50 mb-8">
                  {selectedBook.name} {selectedChapter}
                </p>
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={loadFullChapter}
                    disabled={loading}
                    className="w-full min-h-[56px] rounded-xl font-mono text-sm tracking-[0.15em] uppercase text-white/95 bg-white/10 border border-white/20 hover:bg-white/15 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Loading…" : "Full chapter"}
                  </button>
                  <p className="font-mono text-[10px] tracking-wider text-white/45 text-center">
                    or specific verses
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verseRange}
                      onChange={(e) => setVerseRange(e.target.value)}
                      placeholder="e.g. 1–5 or 3"
                      className="flex-1 bg-white/5 border border-white/15 rounded-lg px-4 py-3 font-sans text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => loadPassage()}
                      disabled={loading}
                      className="min-h-[48px] px-6 rounded-lg font-mono text-xs tracking-wider text-white/90 border border-white/25 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      Read
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 5: Reading — passage + sidebar (desktop) or passage + bottom sheet (mobile) */}
          {step === "reading" && passage && (
            <motion.div
              key="reading"
              custom={dir}
              initial="enter"
              animate="center"
              exit="exit"
              variants={slide}
              transition={{ duration: reduced ? 0.15 : 0.25 }}
              className="w-full min-h-full flex flex-col lg:flex-row lg:overflow-hidden"
            >
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-6 pb-24 sm:px-6 md:px-12 lg:pb-6 box-border">
                <div className="w-full max-w-2xl mx-auto lg:max-w-none">
                  {activePlanSession && (
                    <div className="mb-6 flex flex-col gap-3">
                      <p className="font-mono text-[11px] tracking-wider text-white/55">
                        {sectionMeta
                          ? (() => {
                              let current = 0
                              for (const b of sectionMeta.books) {
                                if (b.bookId === activePlanSession.bookId) {
                                  current += activePlanSession.chapterNumber
                                  break
                                }
                                current += b.chapterCount
                              }
                              return `${passageRef} · ${current} of ${sectionMeta.totalChapters} in ${activePlanSession.sectionLabel}`
                            })()
                          : `${passageRef} · ${activePlanSession.sectionLabel}`}
                      </p>
                      <button
                        type="button"
                        onClick={advancePlanAndNext}
                        className="w-full min-h-[48px] rounded-xl font-mono text-[11px] tracking-[0.15em] uppercase text-white/90 border border-white/20 hover:bg-white/10 transition-colors"
                      >
                        Next chapter
                      </button>
                    </div>
                  )}
                  <motion.div
                    className="mb-8"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: {
                          staggerChildren: stagger,
                          delayChildren: reduced ? 0 : 0.12,
                        },
                      },
                    }}
                  >
                    {passage.verses.map((v, i) => (
                      <motion.p
                        key={v.number}
                        variants={{
                          hidden: { opacity: 0, y: 12 },
                          visible: {
                            opacity: 1,
                            y: 0,
                            transition: {
                              duration: reduced ? 0.15 : 0.4,
                              ease: [0.25, 0.46, 0.45, 0.94],
                            },
                          },
                        }}
                        className={`font-sans text-foreground/92 leading-[1.85] mb-5 text-[1.05rem] sm:text-[1.12rem] font-light ${
                          i === 0
                            ? "first-letter:text-2xl first-letter:sm:text-3xl first-letter:font-normal first-letter:mr-0.5 first-letter:float-left"
                            : ""
                        }`}
                      >
                        <span className="font-mono text-white/45 text-sm align-top mr-2 tabular-nums">
                          {v.number}.
                        </span>
                        {v.text}
                      </motion.p>
                    ))}
                  </motion.div>
                  {/* Mobile: reflection as the next step (after reading), not stuck at bottom */}
                  <div className="lg:hidden mt-10 pt-8 border-t border-white/10">
                    <button
                      type="button"
                      onClick={openReflection}
                      className="w-full min-h-[56px] rounded-xl font-mono text-[11px] tracking-[0.18em] uppercase text-white/85 border border-white/20 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <PenLine className="w-4 h-4" />
                      Continue to reflection
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop: right sidebar for journal (same pattern as scripture reader) */}
              <aside
                className="hidden lg:flex lg:flex-col lg:shrink-0 lg:w-[22rem] border-l border-white/10 bg-[#050505] z-10"
                aria-label="Journal"
              >
                <div className="shrink-0 px-6 pt-6 pb-2">
                  <p className="font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase">
                    After reading
                  </p>
                </div>
                <div
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <JournalPanel
                    passageRef={passageRef}
                    prayer={prayer}
                    reflection={reflection}
                    onPrayerChange={handlePrayerChange}
                    onReflectionChange={handleReflectionChange}
                    onBlur={scheduleSave}
                  />
                </div>
              </aside>
            </motion.div>
          )}

          {/* Step: Reflection — full-screen journal (mobile primary; desktop can use sidebar or this) */}
          {step === "reflection" && passage && (
            <motion.div
              key="reflection"
              custom={dir}
              initial="enter"
              animate="center"
              exit="exit"
              variants={slide}
              transition={{ duration: reduced ? 0.15 : 0.25 }}
              className="w-full min-h-full flex flex-col px-4 py-6 sm:px-6 md:px-12 lg:max-w-2xl lg:mx-auto lg:py-12 box-border"
            >
              <div className="mb-6">
                <p className="font-mono text-[10px] tracking-[0.2em] text-white/50 uppercase mb-1">
                  After reading
                </p>
                <p className="font-sans text-lg font-light text-white/90">{passageRef}</p>
              </div>
              <div className="flex-1">
                <JournalPanel
                  passageRef={passageRef}
                  prayer={prayer}
                  reflection={reflection}
                  onPrayerChange={handlePrayerChange}
                  onReflectionChange={handleReflectionChange}
                  onBlur={scheduleSave}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* Mobile: bottom sheet for journal */}
      <AnimatePresence>
        {step === "reading" && journalSheetOpen && (
          <MobileJournalSheet onDismiss={() => setJournalSheetOpen(false)}>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <JournalPanel
                passageRef={passageRef}
                prayer={prayer}
                reflection={reflection}
                onPrayerChange={handlePrayerChange}
                onReflectionChange={handleReflectionChange}
                onBlur={scheduleSave}
              />
            </div>
          </MobileJournalSheet>
        )}
      </AnimatePresence>

      {/* Mobile: optional quick journal sheet (pill removed — use "Continue to reflection" as primary path) */}

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="border-white/10 bg-[#0a0a0a] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg font-light text-white">
              Menu
            </DialogTitle>
          </DialogHeader>
          {settings.showTracking && (tracking.totalSessions > 0 || currentStreak(tracking) > 0) && (
            <div className="flex items-center gap-4 font-mono text-[11px] tracking-wider text-white/55 pb-3 border-b border-white/10">
              {currentStreak(tracking) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  {currentStreak(tracking)} day streak
                </span>
              )}
              {sessionsThisWeek(tracking) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {sessionsThisWeek(tracking)} this week
                </span>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { setMoreOpen(false); setSettingsOpen(true); }}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/80 hover:text-white py-3 px-4 rounded-lg border border-white/15 hover:bg-white/5 transition-colors text-left"
            >
              <Settings className="w-4 h-4 shrink-0" />
              Devotions settings
            </button>
            <button
              type="button"
              onClick={() => { setMoreOpen(false); goToBook(); }}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/80 hover:text-white py-3 px-4 rounded-lg border border-white/15 hover:bg-white/5 transition-colors text-left"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              Choose another passage
            </button>
            <Link
              href={passageRef ? (getReaderUrlFromReference(passageRef) ?? "/bible") : "/bible"}
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/80 hover:text-white py-3 px-4 rounded-lg border border-white/15 hover:bg-white/5 transition-colors text-left"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              Open in full Scripture reader
            </Link>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/80 hover:text-white py-3 px-4 rounded-lg border border-white/15 hover:bg-white/5 transition-colors text-left"
            >
              <Download className="w-4 h-4 shrink-0" />
              Export backup
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/80 hover:text-white py-3 px-4 rounded-lg border border-white/15 hover:bg-white/5 transition-colors text-left"
            >
              <Upload className="w-4 h-4 shrink-0" />
              Restore from file
            </button>
          </div>
          <p className="font-mono text-[10px] tracking-wider text-white/40 mt-2">
            Prayers and reflections are stored only on this device.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="border-white/10 bg-[#0a0a0a] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg font-light text-white">
              Devotions settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="font-sans text-sm text-white/90">Show devotion tracking</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showTracking}
                onClick={() => {
                  const next = !settings.showTracking
                  setShowTracking(next)
                  setSettings((s) => ({ ...s, showTracking: next }))
                  setTracking(getDevotionsTracking())
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
                  settings.showTracking ? "bg-white/20 border-white/30" : "bg-white/5 border-white/15"
                }`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform mt-0.5 ${
                    settings.showTracking ? "translate-x-6 ml-0.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
            <p className="font-mono text-[10px] tracking-wider text-white/45">
              When on, you’ll see streak and “this week” on the landing and in the menu. Your data stays on this device.
            </p>
            <div className="pt-2 border-t border-white/10">
              <p className="font-sans text-sm text-white/90 mb-2">Chapters per session (reading plans)</p>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setChaptersPerDay(n)
                      setSettings((s) => ({ ...s, chaptersPerDay: n }))
                    }}
                    className={`min-h-[36px] px-4 rounded-lg font-mono text-xs border transition-colors ${
                      settings.chaptersPerDay === n
                        ? "bg-white/20 border-white/30 text-white"
                        : "border-white/15 text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[10px] tracking-wider text-white/45 mt-1.5">
                How many chapters to advance when you tap “Next chapter” in a plan (future use).
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
