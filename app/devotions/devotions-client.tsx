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
} from "lucide-react"
import { getPassageEntry, savePassageEntry } from "@/lib/devotions-storage"
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

type Step = "testament" | "book" | "chapter" | "verses" | "reading"

const SAVE_DEBOUNCE_MS = 400

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -24 : 24, opacity: 0 }),
}

export function DevotionsClient() {
  const [step, setStep] = useState<Step>("testament")
  const [dir, setDir] = useState(0) // 1 = forward, -1 = back
  const [passage, setPassage] = useState<PassageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prayer, setPrayer] = useState("")
  const [reflection, setReflection] = useState("")
  const [moreOpen, setMoreOpen] = useState(false)
  const [journalSheetOpen, setJournalSheetOpen] = useState(false)
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
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load passage.")
        toast.error("Could not load passage")
      })
      .finally(() => setLoading(false))
  }, [buildRef])

  const loadFullChapter = useCallback(() => {
    loadPassage("")
  }, [loadPassage])

  const goBack = useCallback(() => {
    setDir(-1)
    if (step === "testament") return
    if (step === "book") setStep("testament")
    else if (step === "chapter") setStep("book")
    else if (step === "verses") setStep("chapter")
    else if (step === "reading") setStep("verses")
  }, [step])

  const goToBook = useCallback(() => {
    setStep("testament")
    setDir(-1)
    setError(null)
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
    toast.success("Backup downloaded")
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
          if (passageRef) {
            const entry = getPassageEntry(passageRef)
            setPrayer(entry.prayer)
            setReflection(entry.reflection)
          }
          toast.success(`Restored ${count} entries`)
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
          {step === "reading" ? (
            <Link
              href="/"
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
              aria-label="Leave devotions"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Leave</span>
            </Link>
          ) : step === "testament" ? (
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
          {step === "testament" && "Where?"}
          {step === "book" && "What book?"}
          {step === "chapter" && "Which chapter?"}
          {step === "verses" && (selectedBook ? `${selectedBook.name} ${selectedChapter}` : "Read")}
          {step === "reading" && (passage?.reference ?? "Devotions")}
        </span>
        <div className="min-w-[80px] flex justify-end gap-1">
          {step === "reading" ? (
            <>
              <button
                type="button"
                onClick={() => setJournalSheetOpen(true)}
                className="lg:hidden min-h-[44px] px-3 flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/50 hover:text-white/80 rounded"
                aria-label="Open journal"
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
                  <p className="font-sans text-xl sm:text-2xl md:text-3xl font-light text-white/90 mb-8 sm:mb-10">
                    Old Testament or New Testament?
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
                    What book?
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
                    Which chapter?
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
                  Read
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

      {/* Mobile: floating pill to open journal when sheet is closed */}
      <AnimatePresence>
        {step === "reading" && !journalSheetOpen && (
          <MobileJournalPill onTap={() => setJournalSheetOpen(true)} />
        )}
      </AnimatePresence>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="border-white/10 bg-[#0a0a0a] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg font-light text-white">
              Menu
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
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
    </div>
  )
}
