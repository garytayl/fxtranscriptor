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
  ChevronLeft,
  PenLine,
  X,
  ChevronDown,
  Settings,
  Flame,
  Calendar,
  Bell,
  Languages,
  Gamepad2,
  Library,
  Sparkles,
  TextCursor,
} from "lucide-react"
import { getPassageEntry, savePassageEntry, listPassageEntries, getPassageNotes, saveVerseNote, getVerseNote, type ListedPassageEntry, type VerseNote } from "@/lib/devotions-storage"
import { getDevotionsSettings, setShowTracking, setChaptersPerDay } from "@/lib/devotions-settings"
import {
  getDevotionsTracking,
  recordDevotionSession,
  sessionsThisWeek,
  currentStreak,
} from "@/lib/devotions-tracking"
import { getPassageRefForDate, getLandingComboForDate } from "@/lib/devotions-passages"
import { getSection, getPredefinedSections, getSectionBookNames } from "@/lib/devotions-sections"
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
import ReactMarkdown from "react-markdown"
import { StudyGuideShell } from "@/app/studies/[studySlug]/[guideSlug]/study-guide-shell"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  supportsNotifications,
  isNotificationPermissionGranted,
  requestNotificationPermission,
  subscribeToPush,
} from "@/lib/notifications"

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
    <div className="space-y-6">
      <div>
        <label
          htmlFor="devotions-prayer"
          className="block font-sans text-sm font-light text-white/80 mb-2"
        >
          A prayer in your own words
        </label>
        <textarea
          id="devotions-prayer"
          value={prayer}
          onChange={onPrayerChange}
          onBlur={onBlur}
          placeholder="Whatever you want to say—or leave blank"
          rows={4}
          className="w-full min-h-[5rem] bg-white/5 border border-white/10 rounded-xl p-4 font-sans text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/30 resize-y transition-colors"
        />
      </div>
      <div>
        <label
          htmlFor="devotions-reflection"
          className="block font-sans text-sm font-light text-white/80 mb-2"
        >
          {prompt}
        </label>
        <textarea
          id="devotions-reflection"
          value={reflection}
          onChange={onReflectionChange}
          onBlur={onBlur}
          placeholder="Just a line or two—or nothing"
          rows={4}
          className="w-full min-h-[5rem] bg-white/5 border border-white/10 rounded-xl p-4 font-sans text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/30 resize-y transition-colors"
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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[71] bg-[#0a0a0a] border-t border-white/10 rounded-t-[20px] max-h-[88vh] flex flex-col shadow-[0_-4px_40px_rgba(0,0,0,0.5)]"
        data-lenis-prevent
      >
        <div
          className="shrink-0 flex flex-col items-center pt-4 pb-3 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="w-14 h-1.5 rounded-full bg-white/30 active:bg-white/50 transition-colors" />
        </div>
        <div
          className="shrink-0 px-5 pb-4 flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
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
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/8 active:bg-white/15 transition-colors touch-manipulation"
              aria-label="Close journal"
            >
              <X className="size-4 text-white/60" />
            </button>
          </div>
        </div>
        <div className="mx-5 h-px bg-white/8" />
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-6 pb-6"
          style={{ WebkitOverflowScrolling: "touch", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
        <div className="shrink-0 flex items-center justify-center gap-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
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

type Step = "landing" | "planPicker" | "studyPicker" | "studyGuide" | "journalHistory" | "testament" | "book" | "chapter" | "verses" | "reading" | "reflection"

/** Landing grid: four tiles; each expands into a submenu of actions. */
type LandingTileId = "read" | "guided" | "greek" | "journal"

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
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null)
  const [notificationRequesting, setNotificationRequesting] = useState(false)
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

  const [activeVerseNum, setActiveVerseNum] = useState<number | null>(null)
  const [verseNoteText, setVerseNoteText] = useState("")
  const [verseNotes, setVerseNotes] = useState<VerseNote[]>([])
  const [noteSheetOpen, setNoteSheetOpen] = useState(false)

  const [studyList, setStudyList] = useState<{
    title: string
    slug: string
    summary: string
    guides: { label: string; slug: string | undefined; url: string; defaultPassageRef: string | null }[]
  }[]>([])
  const [currentStudy, setCurrentStudy] = useState<{
    title: string
    slug: string
    guideLabel: string
    guideSlug: string
    content: string
    defaultPassageRef: string | null
    allGuides: { label: string; slug: string | undefined }[]
  } | null>(null)
  const [studyLoading, setStudyLoading] = useState(false)
  const [openLandingTile, setOpenLandingTile] = useState<LandingTileId | null>(null)

  const passageRef = passage?.reference ?? ""
  const reduced = useReducedMotion()

  // Load verse notes when passage changes
  useEffect(() => {
    if (passageRef) {
      const notes = getPassageNotes(passageRef)
      setVerseNotes(notes.notes)
    } else {
      setVerseNotes([])
    }
    setActiveVerseNum(null)
    setVerseNoteText("")
  }, [passageRef])

  const handleVerseTap = useCallback((verseNumber: number) => {
    setActiveVerseNum(verseNumber)
    const existing = getVerseNote(passageRef, verseNumber)
    setVerseNoteText(existing)
    setNoteSheetOpen(true)
  }, [passageRef])

  const handleSaveVerseNote = useCallback(() => {
    if (activeVerseNum === null) return
    saveVerseNote(passageRef, activeVerseNum, verseNoteText)
    const updated = getPassageNotes(passageRef)
    setVerseNotes(updated.notes)
    if (!verseNoteText.trim()) {
      setActiveVerseNum(null)
      setNoteSheetOpen(false)
    }
  }, [passageRef, activeVerseNum, verseNoteText])

  const handleCloseNoteSheet = useCallback(() => {
    if (activeVerseNum !== null) handleSaveVerseNote()
    setNoteSheetOpen(false)
    setActiveVerseNum(null)
  }, [activeVerseNum, handleSaveVerseNote])

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
    if (step !== "landing") setOpenLandingTile(null)
  }, [step])

  useEffect(() => {
    if (step !== "landing" || openLandingTile == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenLandingTile(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, openLandingTile])

  useEffect(() => {
    if (moreOpen && supportsNotifications()) {
      setNotificationPermission(Notification.permission)
    }
  }, [moreOpen])

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

  /** Load a specific chapter by number (e.g. for "Last chapter" on the chapter step). */
  const loadChapterNumber = useCallback(
    (chapterNum: number) => {
      if (!selectedBook) return
      const ref = `${selectedBook.name} ${chapterNum}`
      setLoading(true)
      setError(null)
      setActivePlanSession(null)
      setSelectedChapter(chapterNum)
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
    },
    [selectedBook, settings.showTracking]
  )

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
    if (step === "planPicker" || step === "journalHistory") setStep("landing")
    else if (step === "studyGuide") {
      setStep("studyPicker")
      setCurrentStudy(null)
    }
    else if (step === "studyPicker") {
      setStep("landing")
    }
    else if (step === "testament") setStep("landing")
    else if (step === "book") setStep("testament")
    else if (step === "chapter") setStep("book")
    else if (step === "verses") setStep("chapter")
    else if (step === "reading") {
      if (selectedBook != null) setStep("verses")
      else setStep("landing")
    }
    else if (step === "reflection") setStep("reading")
  }, [step, selectedBook])

  const goToBook = useCallback(() => {
    setStep("testament")
    setDir(-1)
    setError(null)
  }, [])

  const enterDevotions = useCallback(() => {
    setDir(1)
    setStep("testament")
  }, [])

  /** Load a passage from journal history and prefill prayer/reflection. */
  const loadPassageFromJournalEntry = useCallback((entry: ListedPassageEntry) => {
    setLoading(true)
    setError(null)
    setActivePlanSession(null)
    fetch(`/api/bible/passage?ref=${encodeURIComponent(entry.passageRef)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setPassage({ reference: data.reference, verses: data.verses ?? [] })
        setPrayer(entry.prayer)
        setReflection(entry.reflection)
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

  const openStudyPicker = useCallback(async () => {
    setStudyLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/devotions/current-study")
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
        return
      }
      setStudyList(data.studies ?? [])
      setDir(1)
      setStep("studyPicker")
    } catch {
      toast.error("Could not load studies")
    } finally {
      setStudyLoading(false)
    }
  }, [])

  const openStudyGuide = useCallback(async (studySlug: string, guideSlug: string) => {
    setStudyLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/devotions/current-study?study=${encodeURIComponent(studySlug)}&guide=${encodeURIComponent(guideSlug)}`)
      const data = await res.json()
      if (data.error || !data.content) {
        toast.error(data.error || "Guide content not available yet")
        return
      }
      setCurrentStudy({
        title: data.studyTitle ?? "Study",
        slug: data.studySlug ?? studySlug,
        guideLabel: data.guideLabel ?? "Guide",
        guideSlug: data.guideSlug ?? guideSlug,
        content: data.content,
        defaultPassageRef: data.defaultPassageRef ?? null,
        allGuides: data.allGuides ?? [],
      })
      setDir(1)
      setStep("studyGuide")
    } catch {
      toast.error("Could not load study guide")
    } finally {
      setStudyLoading(false)
    }
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

  const handleExportJournal = useCallback(() => {
    const entries = listPassageEntries()
    if (entries.length === 0) {
      toast.info("No journal entries to export")
      return
    }
    const lines: string[] = ["# Devotions Journal", "", `Exported ${new Date().toISOString().slice(0, 10)}`, ""]
    entries.forEach((entry) => {
      const date = entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""
      lines.push(`## ${entry.passageRef}${date ? ` (${date})` : ""}`)
      lines.push("")
      if (entry.prayer?.trim()) {
        lines.push("**Prayer**")
        lines.push("")
        lines.push(entry.prayer.trim())
        lines.push("")
      }
      if (entry.reflection?.trim()) {
        lines.push("**Reflection**")
        lines.push("")
        lines.push(entry.reflection.trim())
        lines.push("")
      }
      lines.push("---")
      lines.push("")
    })
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `devotions-journal-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Journal exported as Markdown")
  }, [])

  const stagger = reduced ? 0.02 : 0.06

  return (
    <div className="fixed inset-0 z-[60] flex flex-col h-screen max-h-[100dvh] bg-[#050505] text-white overflow-x-hidden">
      {/* Header: back/leave + title + menu (reading only) */}
      <header className="shrink-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 min-h-[52px] sm:px-6 md:px-12 border-b border-white/5">
        <div className="min-w-[80px] flex justify-start items-center gap-3">
          {step === "landing" ? (
            <Link
              href="/"
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
              aria-label="Leave devotions"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Leave</span>
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={step === "reflection" ? closeReflection : goBack}
                className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
                aria-label={step === "reflection" ? "Back to passage" : "Back"}
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {step === "studyGuide" ? "Studies" : step === "reflection" ? "Passage" : "Back"}
                </span>
              </button>
              <Link
                href="/"
                className="flex items-center gap-1 font-mono text-[10px] tracking-wider text-white/35 hover:text-white/60 min-h-[44px]"
                aria-label="Leave devotions"
              >
                <LogOut className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">Leave</span>
              </Link>
            </>
          )}
        </div>
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/40 truncate max-w-[45vw] text-center">
          {step === "landing" && "Devotions"}
          {step === "planPicker" && "Start a reading plan"}
          {step === "studyPicker" && "Guided studies"}
          {step === "studyGuide" && (currentStudy?.guideLabel ?? "Study Guide")}
          {step === "journalHistory" && "Your journal"}
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
            {/* Step 0: Landing — rotating verse + subtitle by day */}
            {step === "landing" && (() => {
              const combo = getLandingComboForDate(new Date())
              return (
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
                      {combo.verse}
                    </p>
                    <p className="font-mono text-[10px] tracking-[0.25em] text-white/50 uppercase">
                      {combo.reference}
                    </p>
                  </motion.div>
                  <p className="font-sans text-base sm:text-lg text-white/70 font-light max-w-sm mx-auto">
                    {combo.subtitle}
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
                  <div className="w-full max-w-md mx-auto pt-2">
                    <AnimatePresence initial={false} mode="wait">
                      {!openLandingTile ? (
                        <motion.div
                          key="landing-tiles"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: reduced ? 0.12 : 0.2 }}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            {(
                              [
                                {
                                  id: "read" as const,
                                  label: "Read",
                                  hint: "Passage & plans",
                                  icon: BookOpen,
                                  iconClass: "text-white/80",
                                  idle: "border-white/18 bg-white/[0.06] hover:bg-white/[0.1]",
                                },
                                {
                                  id: "guided" as const,
                                  label: "Guided",
                                  hint: "Meditation & studies",
                                  icon: Sparkles,
                                  iconClass: "text-violet-300/90",
                                  idle: "border-violet-400/22 bg-violet-500/[0.07] hover:bg-violet-500/12",
                                },
                                {
                                  id: "greek" as const,
                                  label: "Greek",
                                  hint: "Labs & quest",
                                  icon: Languages,
                                  iconClass: "text-emerald-300/90",
                                  idle: "border-emerald-400/22 bg-emerald-500/[0.07] hover:bg-emerald-500/12",
                                },
                                {
                                  id: "journal" as const,
                                  label: "Journal",
                                  hint: "Saved reflections",
                                  icon: PenLine,
                                  iconClass: "text-cyan-200/85",
                                  idle: "border-cyan-400/20 bg-cyan-500/[0.06] hover:bg-cyan-500/10",
                                },
                              ] as const
                            ).map((tile) => {
                              const Icon = tile.icon
                              return (
                                <button
                                  key={tile.id}
                                  type="button"
                                  onClick={() => setOpenLandingTile(tile.id)}
                                  className={cn(
                                    "group flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
                                    tile.idle,
                                  )}
                                >
                                  <Icon className={cn("size-8 shrink-0", tile.iconClass)} aria-hidden />
                                  <span className="font-sans text-base font-medium tracking-tight text-white/95">
                                    {tile.label}
                                  </span>
                                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45 leading-tight px-1">
                                    {tile.hint}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                          <p className="text-center font-mono text-[9px] tracking-[0.2em] text-white/35 uppercase">
                            Tap a square to open
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={openLandingTile}
                          id={`landing-submenu-${openLandingTile}`}
                          role="region"
                          aria-label="Actions"
                          initial={{ opacity: 0, x: 14 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: reduced ? 0.12 : 0.22 }}
                          className="space-y-4"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setOpenLandingTile(null)}
                              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/85 transition-colors hover:bg-white/[0.09] hover:text-white"
                              aria-label="Back"
                            >
                              <ArrowLeft className="size-4" aria-hidden />
                            </button>
                            <div className="min-w-0 text-left">
                              <p className="font-sans text-lg font-medium text-white/95">
                                {openLandingTile === "read" && "Read"}
                                {openLandingTile === "guided" && "Guided"}
                                {openLandingTile === "greek" && "Greek"}
                                {openLandingTile === "journal" && "Journal"}
                              </p>
                              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                                {openLandingTile === "read" && "Passage & plans"}
                                {openLandingTile === "guided" && "Meditation & studies"}
                                {openLandingTile === "greek" && "Labs & quest"}
                                {openLandingTile === "journal" && "Saved reflections"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/12 bg-black/40 px-3 py-3 sm:px-4">
                          {openLandingTile === "read" && (
                            <div className="flex flex-col gap-2">
                              {readingPlan && (
                                <button
                                  type="button"
                                  onClick={continueReadingPlan}
                                  disabled={loading || booksLoading}
                                  className="w-full min-h-[48px] rounded-xl font-sans text-[15px] font-light text-white/95 bg-white/12 border border-white/22 hover:bg-white/18 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  {loading ? "Loading…" : booksLoading ? "Preparing…" : `Continue · ${getSection(readingPlan.sectionId)?.label ?? readingPlan.sectionId}`}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={loadTodaysPassage}
                                disabled={loading}
                                className="w-full min-h-[48px] rounded-xl font-sans text-[15px] font-light text-white/95 bg-white/8 border border-white/18 hover:bg-white/14 transition-colors disabled:opacity-50"
                              >
                                {loading ? "Loading…" : "Today’s passage"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenLandingTile(null)
                                  setDir(1)
                                  setStep("planPicker")
                                }}
                                disabled={booksLoading}
                                className="w-full min-h-[44px] rounded-xl font-mono text-[10px] tracking-[0.18em] uppercase text-white/72 border border-white/14 hover:bg-white/8 transition-colors disabled:opacity-50"
                              >
                                {booksLoading ? "Preparing…" : "Start a reading plan"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenLandingTile(null)
                                  enterDevotions()
                                }}
                                className="w-full min-h-[44px] rounded-xl font-mono text-[10px] tracking-[0.18em] uppercase text-white/72 border border-white/14 hover:bg-white/8 transition-colors"
                              >
                                Choose a passage
                              </button>
                            </div>
                          )}

                          {openLandingTile === "guided" && (
                            <div className="flex flex-col gap-2">
                              <Link
                                href="/devotions/meditation"
                                onClick={() => setOpenLandingTile(null)}
                                className="w-full min-h-[48px] rounded-xl font-sans text-[15px] font-light text-white/95 bg-violet-500/12 border border-violet-400/28 hover:bg-violet-500/18 transition-colors flex items-center justify-center gap-2"
                              >
                                <TextCursor className="w-5 h-5 text-violet-300/85 shrink-0" aria-hidden />
                                Meditation · full screen
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenLandingTile(null)
                                  void openStudyPicker()
                                }}
                                disabled={studyLoading}
                                className="w-full min-h-[48px] rounded-xl font-sans text-[15px] font-light text-white/95 bg-amber-500/10 border border-amber-500/28 hover:bg-amber-500/16 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                <BookOpen className="w-5 h-5 text-amber-400/85 shrink-0" aria-hidden />
                                {studyLoading ? "Loading…" : "Guided studies"}
                              </button>
                            </div>
                          )}

                          {openLandingTile === "greek" && (
                            <div className="flex flex-col gap-2">
                              <Link
                                href="/devotions/greek"
                                onClick={() => setOpenLandingTile(null)}
                                className="w-full min-h-[48px] rounded-xl font-sans text-[15px] font-light text-white/95 bg-emerald-500/12 border border-emerald-400/32 hover:bg-emerald-500/18 transition-colors flex items-center justify-center gap-2"
                              >
                                <Languages className="w-5 h-5 text-emerald-400/85 shrink-0" aria-hidden />
                                Greek study home
                              </Link>
                              <Link
                                href="/devotions/greek/endings"
                                onClick={() => setOpenLandingTile(null)}
                                className="w-full min-h-[44px] rounded-xl font-sans text-sm font-light text-white/90 bg-emerald-500/6 border border-emerald-400/22 hover:bg-emerald-500/12 transition-colors flex items-center justify-center gap-2"
                              >
                                <Languages className="w-5 h-5 text-emerald-400/75 shrink-0" aria-hidden />
                                Endings Lab
                              </Link>
                              <Link
                                href="/devotions/greek/reader"
                                onClick={() => setOpenLandingTile(null)}
                                className="w-full min-h-[44px] rounded-xl font-sans text-sm font-light text-white/90 bg-amber-500/6 border border-amber-500/22 hover:bg-amber-500/12 transition-colors flex items-center justify-center gap-2"
                              >
                                <BookOpen className="w-5 h-5 text-amber-400/75 shrink-0" aria-hidden />
                                Grammar Reader
                              </Link>
                              <Link
                                href="/devotions/greek/quest"
                                onClick={() => setOpenLandingTile(null)}
                                className="w-full min-h-[44px] rounded-xl font-sans text-sm font-light text-white/90 bg-emerald-500/6 border border-emerald-500/22 hover:bg-emerald-500/12 transition-colors flex items-center justify-center gap-2"
                              >
                                <Gamepad2 className="w-5 h-5 text-emerald-400/75 shrink-0" aria-hidden />
                                Verse Quest
                              </Link>
                              <Link
                                href="/devotions/greek/words"
                                onClick={() => setOpenLandingTile(null)}
                                className="w-full min-h-[44px] rounded-xl font-sans text-sm font-light text-white/88 bg-white/[0.04] border border-white/15 hover:bg-white/[0.08] transition-colors flex items-center justify-center gap-2"
                              >
                                <Library className="w-5 h-5 text-emerald-300/70 shrink-0" aria-hidden />
                                Word bank · all forms
                              </Link>
                            </div>
                          )}

                          {openLandingTile === "journal" && (
                            <div className="flex flex-col gap-2">
                              {typeof window !== "undefined" && listPassageEntries().length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenLandingTile(null)
                                    setDir(1)
                                    setStep("journalHistory")
                                  }}
                                  className="w-full min-h-[48px] rounded-xl font-mono text-[11px] tracking-[0.18em] uppercase text-white/88 border border-white/16 bg-white/[0.05] hover:bg-white/10 transition-colors"
                                >
                                  Open your journal
                                </button>
                              ) : (
                                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center font-sans text-sm text-white/55 leading-relaxed">
                                  Saved prayers and reflections show up here after you write in a passage.
                                </p>
                              )}
                            </div>
                          )}
                          </div>
                          <p className="text-center font-mono text-[9px] tracking-[0.2em] text-white/35 uppercase">
                            Esc to go back
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
              )
            })()}

            {/* Step: Journal history — list past reflections */}
            {step === "journalHistory" && (
              <motion.div
                key="journalHistory"
                custom={dir}
                initial="enter"
                animate="center"
                exit="exit"
                variants={slide}
                transition={{ duration: reduced ? 0.15 : 0.25 }}
                className="w-full px-4 py-6 sm:px-6 md:px-12 md:py-12 pb-12 box-border"
              >
                <div className="w-full max-w-lg md:max-w-2xl mx-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div>
                      <p className="font-sans text-xl sm:text-2xl font-light text-white/90 mb-2">
                        Your journal
                      </p>
                      <p className="font-mono text-[10px] tracking-wider text-white/60">
                        Tap an entry to open the passage and your reflection.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportJournal}
                      className="shrink-0 flex items-center gap-2 font-mono text-[10px] tracking-wider text-white/60 hover:text-white/80 border border-white/15 hover:border-white/25 rounded-lg px-3 py-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export as Markdown
                    </button>
                  </div>
                  <ul className="space-y-0 border border-white/10 rounded-xl overflow-hidden divide-y divide-white/10">
                    {typeof window !== "undefined" &&
                      listPassageEntries().map((entry) => {
                        const snippet = entry.reflection?.trim() || entry.prayer?.trim() || "—"
                        const oneLine = snippet.length > 80 ? snippet.slice(0, 80).trim() + "…" : snippet
                        const dateLabel = entry.updatedAt
                          ? new Date(entry.updatedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : ""
                        return (
                          <li key={`${entry.passageRef}-${entry.updatedAt ?? ""}`}>
                            <button
                              type="button"
                              onClick={() => loadPassageFromJournalEntry(entry)}
                              disabled={loading}
                              className="w-full text-left px-4 py-4 sm:px-5 sm:py-5 hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                              <p className="font-sans text-base font-medium text-white/95">
                                {entry.passageRef}
                              </p>
                              {dateLabel && (
                                <p className="font-mono text-[10px] tracking-wider text-white/50 mt-0.5">
                                  {dateLabel}
                                </p>
                              )}
                              <p className="font-sans text-sm text-white/60 mt-1 line-clamp-2">
                                {oneLine}
                              </p>
                            </button>
                          </li>
                        )
                      })}
                  </ul>
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
                  <p className="font-mono text-[10px] tracking-wider text-white/60 mb-6 sm:mb-8">
                    Pick up where you left off each time.
                  </p>
                  <ul className="space-y-0 md:max-h-[50vh] md:overflow-y-auto md:pr-1">
                    {getPredefinedSections().map((sec) => {
                      const bookNames = getSectionBookNames(sec)
                      return (
                        <li key={sec.id}>
                          <button
                            type="button"
                            onClick={() => startReadingPlan(sec.id)}
                            disabled={loading || booksLoading}
                            className="w-full flex items-center justify-between gap-3 py-4 sm:py-5 text-left border-b border-white/10 font-sans text-base sm:text-lg text-white/90 hover:text-white hover:bg-white/5 transition-colors min-h-[56px] disabled:opacity-50"
                          >
                            <span className="flex-1 min-w-0 text-left">
                              <span className="block truncate">{sec.label}</span>
                              <span className="block font-sans text-xs text-white/55 mt-0.5 leading-snug">
                                {bookNames.join(", ")}
                              </span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0 self-center">
                              <span className="font-mono text-[11px] tracking-wider text-white/60 tabular-nums">
                                {sec.bookIds.length} book{sec.bookIds.length !== 1 ? "s" : ""}
                              </span>
                              <ChevronRight className="w-5 h-5 text-white/40" aria-hidden />
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </motion.div>
            )}

            {/* Step: Study picker — show all studies and their guides */}
            {step === "studyPicker" && (
              <motion.div
                key="studyPicker"
                custom={dir}
                initial="enter"
                animate="center"
                exit="exit"
                variants={slide}
                transition={{ duration: reduced ? 0.15 : 0.25 }}
                className="w-full px-4 py-6 sm:px-6 md:px-12 md:py-12 lg:py-16 pb-12 box-border"
              >
                <div className="w-full max-w-lg md:max-w-2xl mx-auto">
                  <p className="font-sans text-xl sm:text-2xl md:text-3xl font-light text-white/90 mb-2">
                    Guided studies
                  </p>
                  <p className="font-mono text-[10px] tracking-wider text-white/60 mb-8">
                    Pick a study and week to read.
                  </p>

                  {studyList.length === 0 && (
                    <p className="font-mono text-sm text-white/50">No studies available.</p>
                  )}

                  <div className="space-y-8">
                    {studyList.map((study) => (
                      <div key={study.slug}>
                        <h3 className="font-sans text-lg sm:text-xl font-medium text-white/95 mb-1">
                          {study.title}
                        </h3>
                        {study.summary && (
                          <p className="font-sans text-xs text-white/50 mb-4 line-clamp-2 leading-relaxed">
                            {study.summary}
                          </p>
                        )}
                        <ul className="space-y-0 border border-white/10 rounded-xl overflow-hidden divide-y divide-white/10">
                          {study.guides.map((guide, i) => {
                            const hasSlug = !!guide.slug
                            return (
                              <li key={guide.slug ?? guide.url ?? i}>
                                <button
                                  type="button"
                                  disabled={!hasSlug || studyLoading}
                                  onClick={() => hasSlug && openStudyGuide(study.slug, guide.slug!)}
                                  className="w-full flex items-center gap-3 px-4 py-4 sm:px-5 text-left hover:bg-white/5 active:bg-white/8 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-bold text-white/60">
                                    {i + 1}
                                  </span>
                                  <span className="flex-1 min-w-0">
                                    <span className="block font-sans text-sm text-white/90 truncate">{guide.label}</span>
                                    {!hasSlug && (
                                      <span className="block font-mono text-[9px] text-white/40 mt-0.5">Notion only</span>
                                    )}
                                  </span>
                                  <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step: Current study guide */}
            {step === "studyGuide" && currentStudy && (() => {
              const guides = currentStudy.allGuides ?? []
              const currentIdx = guides.findIndex((g) => g.slug === currentStudy.guideSlug)
              const prevG = currentIdx > 0 ? guides[currentIdx - 1] : null
              const nextG = currentIdx >= 0 && currentIdx < guides.length - 1 ? guides[currentIdx + 1] : null
              return (
                <motion.div
                  key={`studyGuide-${currentStudy.guideSlug}`}
                  custom={dir}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  variants={slide}
                  transition={{ duration: reduced ? 0.15 : 0.25 }}
                  className="w-full px-4 py-6 sm:px-6 md:px-12 md:py-12 pb-12 box-border lg:pr-[22rem]"
                  style={{ ["--navbar-offset" as string]: "52px" }}
                >
                  <div className="w-full max-w-4xl mx-auto lg:max-w-none">
                    {/* Guide pills */}
                    {guides.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 mb-6">
                        {guides.map((g, i) => {
                          const isCurrent = g.slug === currentStudy.guideSlug
                          const hasSlug = !!g.slug
                          return (
                            <button
                              key={g.slug ?? i}
                              type="button"
                              disabled={!hasSlug || studyLoading}
                              onClick={() => hasSlug && g.slug !== currentStudy.guideSlug && openStudyGuide(currentStudy.slug, g.slug!)}
                              className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors min-h-[32px] disabled:opacity-40 ${
                                isCurrent
                                  ? "bg-amber-500/15 border border-amber-500/40 text-amber-200"
                                  : "border border-white/10 text-white/50 hover:border-white/25 hover:text-white/80 active:bg-white/5"
                              }`}
                            >
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold">
                                {i + 1}
                              </span>
                              <span className="hidden sm:inline max-w-[100px] truncate">{g.label.replace(/^Wk \d+:\s*/, "")}</span>
                              <span className="sm:hidden">Wk {i + 1}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <StudyGuideShell
                      content={currentStudy.content}
                      defaultPassageRef={currentStudy.defaultPassageRef}
                      title={currentStudy.guideLabel}
                      description={currentStudy.title}
                      sidebarTopOffset="52px"
                    />

                    {/* Prev / Next navigation */}
                    {(prevG || nextG) && (
                      <div className="flex items-center justify-between gap-3 border-t border-white/10 mt-10 pt-6 pb-8">
                        {prevG?.slug ? (
                          <button
                            type="button"
                            disabled={studyLoading}
                            onClick={() => openStudyGuide(currentStudy.slug, prevG.slug!)}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 active:bg-white/15 px-4 py-3 font-mono text-xs text-white/80 transition-colors min-h-[48px] disabled:opacity-50"
                          >
                            <ChevronLeft className="size-4 text-white/50" />
                            <span className="truncate max-w-[120px] sm:max-w-none">{prevG.label}</span>
                          </button>
                        ) : <div />}
                        {nextG?.slug ? (
                          <button
                            type="button"
                            disabled={studyLoading}
                            onClick={() => openStudyGuide(currentStudy.slug, nextG.slug!)}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 active:bg-amber-500/15 px-4 py-3 font-mono text-xs text-amber-200/90 transition-colors min-h-[48px] disabled:opacity-50"
                          >
                            <span className="truncate max-w-[120px] sm:max-w-none">{nextG.label}</span>
                            <ChevronRight className="size-4 text-amber-400/60" />
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })()}

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
                    <>
                      {chapters.length > 0 && (
                        <button
                          type="button"
                          onClick={() => loadChapterNumber(chapters[chapters.length - 1].number)}
                          disabled={loading}
                          className="w-full min-h-[48px] rounded-xl font-mono text-[11px] tracking-[0.15em] uppercase text-white/80 border border-white/15 hover:bg-white/10 hover:text-white transition-colors mb-4 disabled:opacity-50"
                        >
                          {loading ? "Loading…" : `Last chapter (${chapters[chapters.length - 1].number})`}
                        </button>
                      )}
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
                    </>
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
                    {passage.verses.map((v, i) => {
                      const hasNote = verseNotes.some((n) => n.verseNumber === v.number)
                      const isActive = activeVerseNum === v.number
                      return (
                        <div
                          key={v.number}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleVerseTap(v.number)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleVerseTap(v.number) }}
                          style={{ touchAction: "manipulation" }}
                          className={`group relative rounded-lg transition-colors cursor-pointer mb-1 select-none ${
                            isActive
                              ? "bg-amber-500/10 ring-1 ring-amber-500/30"
                              : hasNote
                                ? "bg-white/[0.03]"
                                : "hover:bg-white/[0.03] active:bg-white/[0.05]"
                          }`}
                        >
                          <p
                            className={`font-sans text-foreground/92 leading-[1.85] py-2.5 px-3 text-[1.05rem] sm:text-[1.12rem] font-light pointer-events-none ${
                              i === 0
                                ? "first-letter:text-2xl first-letter:sm:text-3xl first-letter:font-normal first-letter:mr-0.5 first-letter:float-left"
                                : ""
                            }`}
                          >
                            <span className={`font-mono text-sm align-top mr-2 tabular-nums ${isActive ? "text-amber-400/80" : "text-white/45"}`}>
                              {v.number}.
                            </span>
                            {v.text}
                          </p>
                          {hasNote && (
                            <div className="absolute right-2 top-2.5 pointer-events-none">
                              <div className="w-2 h-2 rounded-full bg-amber-400/70" />
                            </div>
                          )}
                        </div>
                      )
                    })}
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

              {/* Desktop: right sidebar — verse notes + journal */}
              <aside
                className="hidden lg:flex lg:flex-col lg:shrink-0 lg:w-[22rem] bg-[#050505] z-10"
                aria-label="Journal & Notes"
              >
                <div
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {/* Active verse note editor */}
                  <AnimatePresence mode="wait">
                    {activeVerseNum !== null && (
                      <motion.div
                        key={`note-${activeVerseNum}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="px-6 pt-5 pb-4 border-b border-white/10"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-mono text-[10px] tracking-[0.2em] text-amber-300/70 uppercase">
                            Verse {activeVerseNum} — your thoughts
                          </p>
                          <button
                            type="button"
                            onClick={() => { handleSaveVerseNote(); setActiveVerseNum(null) }}
                            className="text-white/40 hover:text-white/70 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          value={verseNoteText}
                          onChange={(e) => setVerseNoteText(e.target.value)}
                          onBlur={handleSaveVerseNote}
                          placeholder="What stands out to you about this verse?"
                          rows={3}
                          autoFocus
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 font-sans text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/30 resize-y transition-colors"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Saved verse notes list */}
                  {verseNotes.length > 0 && (
                    <div className="px-6 pt-4 pb-4 border-b border-white/10">
                      <p className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase mb-3">
                        Your notes ({verseNotes.length})
                      </p>
                      <div className="space-y-2.5">
                        {verseNotes.map((n) => (
                          <button
                            key={n.verseNumber}
                            type="button"
                            onClick={() => handleVerseTap(n.verseNumber)}
                            className={`w-full text-left rounded-lg p-3 transition-colors ${
                              activeVerseNum === n.verseNumber
                                ? "bg-amber-500/10 border border-amber-500/25"
                                : "bg-white/[0.03] border border-white/5 hover:border-white/15"
                            }`}
                          >
                            <span className="font-mono text-[10px] text-amber-300/60 uppercase">v{n.verseNumber}</span>
                            <p className="font-sans text-xs text-white/75 mt-1 line-clamp-2 leading-relaxed">{n.note}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Journal panel */}
                  <div className="px-6 pt-5 pb-6">
                    <p className="font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase mb-4">
                      After reading
                    </p>
                    <JournalPanel
                      passageRef={passageRef}
                      prayer={prayer}
                      reflection={reflection}
                      onPrayerChange={handlePrayerChange}
                      onReflectionChange={handleReflectionChange}
                      onBlur={scheduleSave}
                    />
                  </div>
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

      {/* Mobile: bottom sheet for verse note */}
      <AnimatePresence>
        {step === "reading" && noteSheetOpen && activeVerseNum !== null && (
          <MobileJournalSheet onDismiss={handleCloseNoteSheet}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] tracking-[0.2em] text-amber-300/70 uppercase">
                  Verse {activeVerseNum}
                </p>
                {verseNoteText.trim() && (
                  <span className="font-mono text-[9px] text-white/30">auto-saved</span>
                )}
              </div>
              <textarea
                value={verseNoteText}
                onChange={(e) => setVerseNoteText(e.target.value)}
                onBlur={handleSaveVerseNote}
                placeholder="What stands out to you about this verse?"
                rows={4}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 font-sans text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/30 resize-y transition-colors"
              />
              {/* Show other notes for context */}
              {verseNotes.filter((n) => n.verseNumber !== activeVerseNum).length > 0 && (
                <div className="pt-3 border-t border-white/10">
                  <p className="font-mono text-[9px] tracking-wider text-white/30 uppercase mb-2">
                    Other notes
                  </p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {verseNotes
                      .filter((n) => n.verseNumber !== activeVerseNum)
                      .map((n) => (
                        <button
                          key={n.verseNumber}
                          type="button"
                          onClick={() => handleVerseTap(n.verseNumber)}
                          className="w-full text-left rounded-lg p-2.5 bg-white/[0.03] border border-white/5"
                        >
                          <span className="font-mono text-[9px] text-amber-300/50">v{n.verseNumber}</span>
                          <p className="font-sans text-xs text-white/60 mt-0.5 line-clamp-1">{n.note}</p>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </MobileJournalSheet>
        )}
      </AnimatePresence>

      {/* Mobile: bottom sheet for journal */}
      <AnimatePresence>
        {step === "reading" && journalSheetOpen && !noteSheetOpen && (
          <MobileJournalSheet onDismiss={() => setJournalSheetOpen(false)}>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
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
            {supportsNotifications() && notificationPermission !== "granted" && (
              <button
                type="button"
                onClick={async () => {
                  setNotificationRequesting(true)
                  try {
                    const p = await requestNotificationPermission()
                    setNotificationPermission(p)
                    if (p === "granted") {
                      const sub = await subscribeToPush()
                      if (sub.ok) {
                        toast.success("Notifications enabled", { description: "You’ll get devotions reminders when we send them." })
                      } else {
                        toast.success("Notifications allowed", { description: sub.error || "Reminders will work once configured." })
                      }
                    } else if (p === "denied") {
                      toast.info("Notifications blocked", { description: "You can enable them in device settings." })
                    }
                  } catch {
                    toast.error("Could not enable notifications")
                  } finally {
                    setNotificationRequesting(false)
                  }
                }}
                disabled={notificationRequesting}
                className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/80 hover:text-white py-3 px-4 rounded-lg border border-white/15 hover:bg-white/5 transition-colors text-left disabled:opacity-50"
              >
                <Bell className="w-4 h-4 shrink-0" />
                {notificationRequesting ? "Enabling…" : "Enable notifications"}
              </button>
            )}
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
            <Link
              href="/devotions/greek"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-emerald-200/90 hover:text-emerald-100 py-3 px-4 rounded-lg border border-emerald-500/25 hover:bg-emerald-500/10 transition-colors text-left"
            >
              <Languages className="w-4 h-4 shrink-0" />
              Greek study home
            </Link>
            <Link
              href="/devotions/greek/endings"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-emerald-200/90 hover:text-emerald-100 py-3 px-4 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors text-left"
            >
              <Languages className="w-4 h-4 shrink-0" />
              Greek Endings Lab
            </Link>
            <Link
              href="/devotions/greek/reader"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-amber-200/90 hover:text-amber-100 py-3 px-4 rounded-lg border border-amber-500/25 hover:bg-amber-500/10 transition-colors text-left"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              Grammar Reader
            </Link>
            <Link
              href="/devotions/greek/quest"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-emerald-200/90 hover:text-emerald-100 py-3 px-4 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors text-left"
            >
              <Gamepad2 className="w-4 h-4 shrink-0" />
              Verse Quest · quick quiz loop
            </Link>
            <Link
              href="/devotions/greek/words"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-emerald-200/85 hover:text-emerald-100 py-3 px-4 rounded-lg border border-white/12 hover:bg-white/5 transition-colors text-left"
            >
              <Library className="w-4 h-4 shrink-0" />
              Greek word bank
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
