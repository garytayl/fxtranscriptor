"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { ArrowLeft, ChevronRight, Search } from "lucide-react"

import { TranslationSettings } from "@/app/bible/_components/translation-settings"

type TranslationOption = { key: string; label: string; bibleId: string }

type BibleBook = { id: string; name: string; slug: string; testament?: string }
type BibleChapter = { id: string; number: number }

type Step = "testament" | "book" | "chapter" | "open"

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -24 : 24, opacity: 0 }),
}

type BiblePickerClientProps = {
  translations: TranslationOption[]
  currentKey: string | null
}

export function BiblePickerClient({ translations, currentKey }: BiblePickerClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const translationKey = searchParams.get("t") ?? currentKey

  const [step, setStep] = useState<Step>("testament")
  const [dir, setDir] = useState(0)

  const [oldTestament, setOldTestament] = useState<BibleBook[]>([])
  const [newTestament, setNewTestament] = useState<BibleBook[]>([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [selectedTestament, setSelectedTestament] = useState<"old" | "new" | null>(null)
  const [chapters, setChapters] = useState<BibleChapter[]>([])
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [verseRange, setVerseRange] = useState("")
  const [chaptersLoading, setChaptersLoading] = useState(false)

  const reduced = useReducedMotion()
  const books = selectedTestament === "old" ? oldTestament : selectedTestament === "new" ? newTestament : []

  useEffect(() => {
    let cancelled = false
    const t = translationKey ? `?t=${encodeURIComponent(translationKey)}` : ""
    fetch(`/api/bible/books${t}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || data.error) return
        setOldTestament(data.oldTestament ?? [])
        setNewTestament(data.newTestament ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBooksLoading(false) })
    return () => { cancelled = true }
  }, [translationKey])

  useEffect(() => {
    if (!selectedBook) {
      setChapters([])
      setSelectedChapter(null)
      return
    }
    let cancelled = false
    setChaptersLoading(true)
    const t = translationKey ? `?t=${encodeURIComponent(translationKey)}` : ""
    fetch(`/api/bible/book/${encodeURIComponent(selectedBook.id)}/chapters${t}`)
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
  }, [selectedBook, translationKey])

  const goBack = useCallback(() => {
    setDir(-1)
    if (step === "testament") return
    if (step === "book") setStep("testament")
    else if (step === "chapter") setStep("book")
    else if (step === "open") setStep("chapter")
  }, [step])

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
    setStep("open")
  }, [])

  const buildChapterUrl = useCallback((withVerses?: string) => {
    if (!selectedBook || selectedChapter == null) return ""
    const base = `/bible/${selectedBook.slug}/${selectedChapter}`
    const params = new URLSearchParams()
    if (translationKey) params.set("t", translationKey)
    if (withVerses?.trim()) params.set("v", withVerses.trim())
    const q = params.toString()
    return q ? `${base}?${q}` : base
  }, [selectedBook, selectedChapter, translationKey])

  const handleOpenChapter = useCallback(() => {
    const url = buildChapterUrl()
    if (url) router.push(url)
  }, [buildChapterUrl, router])

  const handleOpenVerses = useCallback(() => {
    const url = buildChapterUrl(verseRange)
    if (url) router.push(url)
  }, [buildChapterUrl, verseRange, router])

  const stepTitle =
    step === "testament" ? "Where?" :
    step === "book" ? "What book?" :
    step === "chapter" ? "Which chapter?" :
    selectedBook && selectedChapter != null ? `${selectedBook.name} ${selectedChapter}` : "Open"

  const searchUrl = translationKey ? `/bible/search?t=${encodeURIComponent(translationKey)}` : "/bible/search"

  return (
    <div className="fixed inset-0 z-[55] flex flex-col h-screen max-h-[100dvh] bg-[#050505] text-white overflow-x-hidden">
      <header className="shrink-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 min-h-[52px] sm:px-6 md:px-12 border-b border-white/5">
        <div className="min-w-[80px] flex justify-start">
          {step === "testament" ? (
            <Link
              href="/"
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Back</span>
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
          {stepTitle}
        </span>
        <div className="min-w-[80px] flex justify-end">
          <Link
            href={searchUrl}
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
            aria-label="Look up passage"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Search</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-behavior-y-auto touch-pan-y w-full pb-[env(safe-area-inset-bottom)]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <AnimatePresence mode="wait" custom={dir}>
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
                  <div className="mb-6 flex items-center justify-between gap-4 [&_.text-muted-foreground]:text-white/60 [&_button]:text-white/70 [&_button:hover]:text-white/90">
                    <span className="font-mono text-[10px] tracking-wider text-white/50 uppercase">Translation</span>
                    <TranslationSettings translations={translations} currentKey={translationKey} />
                  </div>
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

            {step === "open" && selectedBook && selectedChapter != null && (
              <motion.div
                key="open"
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
                    Open in reader
                  </p>
                  <p className="font-mono text-[10px] tracking-wider text-white/50 mb-8">
                    {selectedBook.name} {selectedChapter}
                  </p>
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={handleOpenChapter}
                      className="w-full min-h-[56px] rounded-xl font-mono text-sm tracking-[0.15em] uppercase text-white/95 bg-white/10 border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      Full chapter
                    </button>
                    <p className="font-mono text-[10px] tracking-wider text-white/45 text-center">
                      or open with verse range
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
                        onClick={handleOpenVerses}
                        className="min-h-[48px] px-6 rounded-lg font-mono text-xs tracking-wider text-white/90 border border-white/25 hover:bg-white/10 transition-colors"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
