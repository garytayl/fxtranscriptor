"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  LogOut,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Download,
  Upload,
  BookOpen,
} from "lucide-react"
import { getPassageEntry, savePassageEntry } from "@/lib/devotions-storage"
import { getPassageRefForDate } from "@/lib/devotions-passages"
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
  chapterReference?: string
}

function getReflectionPrompt(passageRef: string): string {
  const slug = passageRef.toLowerCase().replace(/\s/g, "").replace(/:/g, "")
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash << 5) - hash + slug.charCodeAt(i)
  const i = Math.abs(hash) % REFLECTION_PROMPTS.length
  return REFLECTION_PROMPTS[i] ?? REFLECTION_PROMPTS[0]
}

const SAVE_DEBOUNCE_MS = 400

export function DevotionsClient() {
  const todayRef = getPassageRefForDate(new Date())
  const [passage, setPassage] = useState<PassageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readingMode, setReadingMode] = useState(false)
  const [prayer, setPrayer] = useState("")
  const [reflection, setReflection] = useState("")
  const [moreOpen, setMoreOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduced = useReducedMotion()

  const passageRef = passage?.reference ?? todayRef

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/bible/passage?ref=${encodeURIComponent(todayRef)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load passage.")
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data.error) throw new Error(data.error)
        setPassage({
          reference: data.reference,
          verses: data.verses ?? [],
          chapterReference: data.chapterReference,
        })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [todayRef])

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

  const handlePrayerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrayer(e.target.value)
    scheduleSave()
  }

  const handleReflectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReflection(e.target.value)
    scheduleSave()
  }

  const copyPassage = useCallback(() => {
    if (!passage?.verses?.length) return
    const text = passage.verses
      .map((v) => `${v.number}. ${v.text}`)
      .join("\n")
    navigator.clipboard?.writeText(`${passage.reference}\n\n${text}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Copied to clipboard")
    })
  }, [passage])

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
          setPrayer(getPassageEntry(passageRef).prayer)
          setReflection(getPassageEntry(passageRef).reflection)
          toast.success(`Restored ${count} entries`)
        } catch {
          toast.error("Invalid backup file")
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [passageRef])

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#050505] text-white overflow-hidden">
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="font-mono text-xs tracking-[0.2em] text-white/50 uppercase">
            Opening the Word…
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#050505] text-white overflow-hidden">
        <header className="flex items-center justify-between px-4 py-4 sm:px-6 md:px-12 min-h-[52px]">
          <Link
            href="/"
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            Leave
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="font-sans text-sm text-white/70 text-center max-w-md">{error}</p>
        </div>
      </div>
    )
  }

  const stagger = reduced ? 0.02 : 0.06

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#050505] text-white overflow-hidden">
      {/* Subtle atmosphere behind scripture */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div
          className="absolute left-1/2 top-[18%] -translate-x-1/2 w-[min(100%,40rem)] h-[45vh] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse 80% 80% at 50% 30%, rgba(255,255,255,0.06), transparent 70%)",
          }}
        />
      </div>

      {/* Minimal top bar */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 min-h-[52px] sm:py-4 sm:px-6 md:px-12 border-b border-white/5">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
          aria-label="Leave devotions"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Leave</span>
        </Link>
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">
          {passage?.reference ?? todayRef}
        </span>
        <div className="flex items-center gap-1">
          {passage?.verses?.length ? (
            <button
              type="button"
              onClick={copyPassage}
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px] p-2 -m-2 rounded"
              aria-label="Copy passage"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Copy</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setReadingMode((m) => !m)}
            className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-white/40 hover:text-white/70 min-h-[44px]"
            aria-label={readingMode ? "Show prayer and reflection" : "Reading mode — hide forms"}
          >
            {readingMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Show response</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reading only</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center font-mono text-[10px] text-white/40 hover:text-white/70 rounded"
            aria-label="Backup and more"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="px-4 py-6 pb-32 sm:px-6 md:px-12 max-w-2xl mx-auto">
          {passage?.verses?.length ? (
            <>
              <motion.div
                className="mb-10"
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

              <Link
                href={getReaderUrlFromReference(passage.reference) ?? "/bible"}
                className="inline-flex items-center gap-2 font-mono text-[10px] tracking-wider text-white/45 hover:text-white/70 mb-8 min-h-[44px]"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Open in Scripture
              </Link>
            </>
          ) : (
            <p className="font-sans text-sm text-white/60">No verses for this passage.</p>
          )}

          {/* Response — prayer + reflection; hidden in reading mode */}
          {!readingMode && passage?.verses?.length ? (
            <motion.section
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduced ? 0 : 0.3 }}
            >
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
            </motion.section>
          ) : null}
        </div>
      </div>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="border-white/10 bg-[#0a0a0a] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg font-light text-white">
              Backup
            </DialogTitle>
          </DialogHeader>
          <p className="font-mono text-[10px] tracking-wider text-white/50 mb-4">
            Your prayers and reflections are stored only on this device. Export a backup so nothing gets lost.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/80 hover:text-white py-3 px-4 rounded-lg border border-white/15 hover:bg-white/5 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export backup
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/80 hover:text-white py-3 px-4 rounded-lg border border-white/15 hover:bg-white/5 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Restore from file
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
