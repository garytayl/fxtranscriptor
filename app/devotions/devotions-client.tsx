"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { LogOut, MoreHorizontal, Download, Upload, BookOpen } from "lucide-react"
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

type BibleBook = { id: string; name: string; slug: string }
type BibleChapter = { id: string; number: number }

function getReflectionPrompt(passageRef: string): string {
  const slug = passageRef.toLowerCase().replace(/\s/g, "").replace(/:/g, "")
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash << 5) - hash + slug.charCodeAt(i)
  const i = Math.abs(hash) % REFLECTION_PROMPTS.length
  return REFLECTION_PROMPTS[i] ?? REFLECTION_PROMPTS[0]
}

const SAVE_DEBOUNCE_MS = 400

export function DevotionsClient() {
  const [view, setView] = useState<"picker" | "reading">("picker")
  const [passage, setPassage] = useState<PassageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prayer, setPrayer] = useState("")
  const [reflection, setReflection] = useState("")
  const [moreOpen, setMoreOpen] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Picker state
  const [books, setBooks] = useState<BibleBook[]>([])
  const [chapters, setChapters] = useState<BibleChapter[]>([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [verseRange, setVerseRange] = useState("") // e.g. "1-5" or "3"
  const [chaptersLoading, setChaptersLoading] = useState(false)

  const passageRef = passage?.reference ?? ""

  useEffect(() => {
    let cancelled = false
    fetch("/api/bible/books")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || data.error) return
        const all: BibleBook[] = [
          ...(data.oldTestament ?? []),
          ...(data.newTestament ?? []),
          ...(data.other ?? []),
        ]
        setBooks(all)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBooksLoading(false)
      })
    return () => { cancelled = true }
  }, [])

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
      .finally(() => {
        if (!cancelled) setChaptersLoading(false)
      })
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
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const buildRef = useCallback((): string | null => {
    if (!selectedBook || selectedChapter == null) return null
    const versePart = verseRange.trim() ? `:${verseRange.trim()}` : ""
    return `${selectedBook.name} ${selectedChapter}${versePart}`
  }, [selectedBook, selectedChapter, verseRange])

  const loadPassage = useCallback(() => {
    const ref = buildRef()
    if (!ref) {
      toast.error("Choose a book and chapter")
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setPassage({
          reference: data.reference,
          verses: data.verses ?? [],
        })
        setView("reading")
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load passage.")
        toast.error("Could not load passage")
      })
      .finally(() => setLoading(false))
  }, [buildRef])

  const goToPicker = useCallback(() => {
    setView("picker")
    setError(null)
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
    keys.forEach((k) => {
      const v = window.localStorage.getItem(k)
      if (v) data[k] = v
    })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fx-devotions-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
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
          if (typeof data !== "object") throw new Error("Invalid format")
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
        } catch {
          toast.error("Invalid backup file")
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [passageRef])

  const reduced = useReducedMotion()
  const stagger = reduced ? 0.02 : 0.06

  return (
    <div className="fixed inset-0 z-[60] flex flex-col h-screen max-h-[100dvh] bg-[#050505] text-white">
      {/* Top bar: Leave + ref (when reading) + ⋯ */}
      <header className="shrink-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 min-h-[52px] sm:px-6 md:px-12 border-b border-white/5">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px] min-w-[44px] items-center"
          aria-label="Leave devotions"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Leave</span>
        </Link>
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/40 truncate max-w-[50vw]">
          {view === "reading" && passage?.reference ? passage.reference : "Devotions"}
        </span>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-white/70 rounded"
          aria-label="Menu"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </header>

      {/* Content: picker or reading — scrollable */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-behavior-y-auto touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {view === "picker" && (
          <div className="px-4 py-6 pb-12 sm:px-6 md:px-12 max-w-lg mx-auto">
            <p className="font-mono text-[10px] tracking-[0.2em] text-white/50 uppercase mb-1">
              Choose what to read
            </p>
            <h1 className="font-sans text-xl sm:text-2xl font-light text-white mb-6">
              Pick a book, chapter, and optional verses
            </h1>

            {error && (
              <p className="text-sm text-red-400/90 mb-4" role="alert">
                {error}
              </p>
            )}

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] tracking-wider text-white/50 mb-2">
                  Book
                </label>
                <select
                  value={selectedBook?.id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value
                    setSelectedBook(books.find((b) => b.id === id) ?? null)
                  }}
                  disabled={booksLoading}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 font-sans text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50"
                >
                  <option value="">Select book</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-wider text-white/50 mb-2">
                  Chapter
                </label>
                <select
                  value={selectedChapter ?? ""}
                  onChange={(e) => {
                    const n = e.target.value ? Number(e.target.value) : null
                    setSelectedChapter(n)
                  }}
                  disabled={!selectedBook || chaptersLoading}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 font-sans text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50"
                >
                  <option value="">Select chapter</option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.number}>
                      {ch.number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-wider text-white/50 mb-2">
                  Verses (optional) — e.g. 1–5 or 3
                </label>
                <input
                  type="text"
                  value={verseRange}
                  onChange={(e) => setVerseRange(e.target.value)}
                  placeholder="Leave blank for full chapter"
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 font-sans text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>

              <button
                type="button"
                onClick={loadPassage}
                disabled={loading || !selectedBook || selectedChapter == null}
                className="w-full min-h-[48px] mt-4 rounded-lg font-mono text-xs tracking-[0.2em] uppercase text-white/90 border border-white/30 hover:bg-white/10 hover:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                {loading ? "Loading…" : "Read"}
              </button>
            </div>

            <p className="mt-8 font-mono text-[10px] tracking-wider text-white/40">
              Your prayers and reflections are saved on this device. Use the menu (⋯) for backup.
            </p>
          </div>
        )}

        {view === "reading" && passage && (
          <div className="px-4 py-6 pb-24 sm:px-6 md:px-12 max-w-2xl mx-auto">
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
          </div>
        )}
      </div>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="border-white/10 bg-[#0a0a0a] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg font-light text-white">
              Menu
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {view === "reading" && (
              <>
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); goToPicker(); }}
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
              </>
            )}
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
