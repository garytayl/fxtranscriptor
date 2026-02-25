"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { WordStudyEntryContent } from "@/components/word-study"
import type { StrongsEntry } from "@/lib/bible/lexicon"

const sidebarEntryClasses =
  "font-sans text-base font-light text-white/90 leading-relaxed [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20 [&_.bg-card]:bg-white/5 [&_.bg-muted]:bg-white/10 [&_.text-accent]:text-amber-200/90"

type WordStudySidebarPanelProps = {
  /** Strong's code to show, e.g. "G26". When null, shows placeholder. */
  code: string | null
}

export function WordStudySidebarPanel({ code }: WordStudySidebarPanelProps) {
  const [entry, setEntry] = useState<StrongsEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      setEntry(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setEntry(null)
    fetch(`/api/bible/lexicon/${encodeURIComponent(code)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found")
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setEntry(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <AnimatePresence mode="wait">
      {!code ? (
        <motion.p
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="font-sans text-sm text-white/40 italic"
        >
          Click a word in the text to view the Greek or Hebrew definition.
        </motion.p>
      ) : loading ? (
        <motion.p
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="font-sans text-sm text-white/50"
        >
          Loading…
        </motion.p>
      ) : error ? (
        <motion.p
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="font-sans text-sm text-red-300/90"
        >
          {error}
        </motion.p>
      ) : entry ? (
        <motion.div
          key={code}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={sidebarEntryClasses}
        >
          <WordStudyEntryContent entry={entry} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
