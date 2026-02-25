"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  LogOut,
  MoreHorizontal,
  Download,
  Upload,
  BookOpen,
  ArrowLeft,
  ChevronRight,
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

const REFLECTION_PROMPTS = [
  "What line or phrase is staying with you?",
  "Where did you see yourself in this passage?",
  "One thing you want to carry from this into your day.",
  "What is this passage saying back to you?",
  "What do you want to remember from this?",
  "A word or image that fits how this lands.",
  "What are you sitting with after reading?",
]

type PassageData = {
  reference: string
  verses: { number: number; text: string }[]
}

type BibleBook = { id: string; name: string; slug: string; testament?: string }
type BibleChapter = { id: string; number: number }

type Step = "testament" | "book" | "chapter" | "verses" | "reading"

function getReflectionPrompt(passageRef: string): string {
  const slug = passageRef.toLowerCase().replace(/\s/g, "").replace(/:/g, "")
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash << 5) - hash + slug.charCodeAt(i)
  const i = Math.abs(hash) % REFLECTION_PROMPTS.length
  return REFLECTION_PROMPTS[i] ?? REFLECTION_PROMPTS[0]
}

const SAVE_DEBOUNCE_MS = 400

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -24 : 24, opacity: 0 }),
}

export function DevotionsClient() {
  const [step, setStep] = useState<Step>("book")
  const [dir, setDir] = useState(0) // 1 = forward, -1 = back
  const [passage, setPassage] = useState<PassageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prayer, setPrayer] = useState("")
  const [reflection, setReflection] = useState("")
  const [moreOpen, setMoreOpen] = useState(false)
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
    <div className="fixed inset-0 z-[60] flex flex-col h-screen max-h-[100dvh] bg-[#050505] text-white">
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
          ) : step === "book" ? (
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
          {step === "book" && "What book?"}
          {step === "chapter" && "Which chapter?"}
          {step === "verses" && (selectedBook ? `${selectedBook.name} ${selectedChapter}` : "Read")}
          {step === "reading" && (passage?.reference ?? "Devotions")}
        </span>
        <div className="min-w-[80px] flex justify-end">
          {step === "reading" ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-white/70 rounded"
              aria-label="Menu"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          ) : (
            <span />
          )}
        </div>
      </header>

      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-behavior-y-auto touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <AnimatePresence mode="wait" custom={dir}>
          {/* Step 1: What book? */}
          {step === "book" && (
            <motion.div
              key="book"
              custom={dir}
              initial="enter"
              animate="center"
              exit="exit"
              variants={slide}
              transition={{ duration: reduced ? 0.15 : 0.25 }}
              className="h-full flex flex-col px-4 py-6 sm:px-6 md:px-12"
            >
              <p className="font-sans text-xl sm:text-2xl font-light text-white/90 mb-6 sm:mb-8">
                What book?
              </p>
              {booksLoading ? (
                <p className="font-mono text-xs tracking-wider text-white/50">Loading…</p>
              ) : (
                <ul className="space-y-0">
                  {books.map((b, i) => (
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
            </motion.div>
          )}

          {/* Step 2: Which chapter? */}
          {step === "chapter" && selectedBook && (
            <motion.div
              key="chapter"
              custom={dir}
              initial="enter"
              animate="center"
              exit="exit"
              variants={slide}
              transition={{ duration: reduced ? 0.15 : 0.25 }}
              className="h-full flex flex-col px-4 py-6 sm:px-6 md:px-12"
            >
              <p className="font-sans text-xl sm:text-2xl font-light text-white/90 mb-2">
                Which chapter?
              </p>
              <p className="font-mono text-[10px] tracking-wider text-white/50 mb-6 sm:mb-8">
                {selectedBook.name}
              </p>
              {chaptersLoading ? (
                <p className="font-mono text-xs tracking-wider text-white/50">Loading…</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 sm:gap-3">
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
            </motion.div>
          )}

          {/* Step 3: Read full chapter or verses */}
          {step === "verses" && selectedBook && selectedChapter != null && (
            <motion.div
              key="verses"
              custom={dir}
              initial="enter"
              animate="center"
              exit="exit"
              variants={slide}
              transition={{ duration: reduced ? 0.15 : 0.25 }}
              className="h-full flex flex-col px-4 py-6 sm:px-6 md:px-12 max-w-lg"
            >
              <p className="font-sans text-xl sm:text-2xl font-light text-white/90 mb-2">
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
            </motion.div>
          )}

          {/* Step 4: Reading */}
          {step === "reading" && passage && (
            <motion.div
              key="reading"
              custom={dir}
              initial="enter"
              animate="center"
              exit="exit"
              variants={slide}
              transition={{ duration: reduced ? 0.15 : 0.25 }}
              className="px-4 py-6 pb-24 sm:px-6 md:px-12 max-w-2xl mx-auto"
            >
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

              <section className="space-y-6">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <p className="font-mono text-[10px] tracking-wider text-white/45 mb-3">
                    After reading
                  </p>
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
                        onChange={handlePrayerChange}
                        onBlur={scheduleSave}
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
                        {getReflectionPrompt(passageRef)}
                      </label>
                      <textarea
                        id="devotions-reflection"
                        value={reflection}
                        onChange={handleReflectionChange}
                        onBlur={scheduleSave}
                        placeholder="Just a line or two—or nothing"
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 font-sans text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/30 resize-y transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
