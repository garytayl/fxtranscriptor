"use client"

import { useState, useCallback } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import type { StrongsEntry } from "@/lib/bible/lexicon"

type WordStudyProps = {
  /** Strong's code, e.g. "G26" or "H3045" */
  code: string
  /** Optional display text (e.g. "love", "agapē"). Defaults to transliteration or code. */
  children?: React.ReactNode
  /** Optional: pass entry directly to avoid fetch (e.g. from server). */
  entry?: StrongsEntry | null
  /** Class name for the trigger button. */
  className?: string
  /** Called when the word is clicked (e.g. to show in a sidebar). */
  onSelect?: (code: string) => void
  /** When true, tooltip explains KJV vs lexicon English (scripture / concordance alignment). */
  showKjvAlignmentNote?: boolean
}

/** Shared display for a Strong's entry (used in tooltip and sidebar). */
export function WordStudyEntryContent({
  entry,
  showKjvAlignmentNote = false,
}: {
  entry: StrongsEntry
  /** When true, explains that lexicon English may differ from KJV verse wording used for Strong’s. */
  showKjvAlignmentNote?: boolean
}) {
  const isGreek = entry.language === "greek"
  return (
    <div className="space-y-2 text-left">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <span
          className="text-xl font-semibold text-foreground"
          lang={isGreek ? "el" : "he"}
          dir={isGreek ? "ltr" : "rtl"}
        >
          {entry.lemma}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
          {entry.code}
        </span>
      </div>
      {entry.transliteration && (
        <p className="font-mono text-sm text-muted-foreground">
          {entry.transliteration}
          {entry.pronunciation && (
            <span className="ml-1.5 text-xs opacity-80">[{entry.pronunciation}]</span>
          )}
        </p>
      )}
      <p className="text-sm font-medium text-foreground">{entry.meaning}</p>
      {entry.definition && (
        <p className="text-xs leading-relaxed text-muted-foreground">{entry.definition}</p>
      )}
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
        {isGreek ? "Greek" : "Hebrew"} · Strong’s
      </p>
      {showKjvAlignmentNote && (
        <p className="text-[10px] leading-snug text-muted-foreground/90 border-t border-border pt-2 mt-1">
          Lexicon glosses use their own English (often modern). The verse line uses KJV wording so each
          word lines up with its Strong&apos;s code.
        </p>
      )}
    </div>
  )
}

export function WordStudy({
  code,
  children,
  entry: entryProp,
  className,
  onSelect,
  showKjvAlignmentNote = false,
}: WordStudyProps) {
  const [entry, setEntry] = useState<StrongsEntry | null>(entryProp ?? null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(!!entryProp)

  const fetchEntry = useCallback(() => {
    if (entryProp != null || fetched) return
    setFetched(true)
    setLoading(true)
    fetch(`/api/bible/lexicon/${encodeURIComponent(code)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StrongsEntry | null) => {
        setEntry(data ?? null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [code, entryProp, fetched])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && !entry && !entryProp) fetchEntry()
    },
    [entry, entryProp, fetchEntry]
  )

  const displayText = children ?? entry?.transliteration ?? entry?.lemma ?? code

  if (entry) {
    return (
      <HoverCard openDelay={200} closeDelay={100} onOpenChange={handleOpenChange}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect?.(code)}
            className={`cursor-help border-b border-dashed border-amber-500/50 font-medium text-amber-200/90 hover:border-amber-500/80 hover:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 rounded-sm ${className ?? ""}`}
            aria-label={`Word study: ${entry.transliteration ?? entry.lemma} (${entry.code})`}
          >
            {displayText}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-[min(20rem,calc(100vw-2rem))] border-white/10 bg-[#0a0a0a] text-white shadow-xl [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20"
        >
          <WordStudyEntryContent entry={entry} showKjvAlignmentNote={showKjvAlignmentNote} />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <HoverCard openDelay={200} closeDelay={100} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect?.(code)}
          className={`cursor-help border-b border-dashed border-amber-500/50 font-medium text-amber-200/90 hover:border-amber-500/80 hover:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 rounded-sm ${className ?? ""}`}
          aria-label={`Word study: ${code}`}
        >
          {loading ? (
            <span className="animate-pulse">{displayText}</span>
          ) : (
            displayText
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="top"
        sideOffset={6}
        className="w-[min(20rem,calc(100vw-2rem))] border-white/10 bg-[#0a0a0a] text-white shadow-xl [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20"
      >
        {loading ? (
          <span className="text-sm text-white/60">Loading…</span>
        ) : (
          <span className="text-sm text-white/60">Definition not available.</span>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
