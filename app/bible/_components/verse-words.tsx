"use client"

import { useCallback, useEffect, useState } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { WordStudyEntryContent } from "@/components/word-study"
import { useLexiconCache } from "@/app/bible/_components/lexicon-cache-context"
import type { StrongsEntry } from "@/lib/bible/lexicon"
import { VerseText } from "@/lib/bible/verse-text"
import type { StrongsWordAndCode } from "@/lib/bible/verse-strongs"

type VerseWordsProps = {
  verseNumber: number
  text: string
  /** When set, verse is rendered from these KJV word+code pairs (correct alignment). Otherwise text is shown with no Strong's. */
  wordsWithCodes?: StrongsWordAndCode[]
  className?: string
  /** When true, words with Strong's get hover styling. */
  highlightStrongs?: boolean
  /** Called when a word with Strong's is clicked (e.g. to show in sidebar). */
  onSelectStrongs?: (code: string) => void
  /** Map marker -> text or { text, href } for tooltips and optional cross-ref link. Used when no wordsWithCodes. */
  footnotesForVerse?: Record<string, string | { text: string; href?: string }>
}

const buttonClasses =
  "cursor-pointer border-b border-dashed border-amber-500/50 font-medium text-amber-200/90 hover:border-amber-500/80 hover:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 rounded-sm"

/** Strip any HTML tags so we never show raw <em> etc. when displaying a word. */
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim()
}

/**
 * Clickable word with Strong's code. Hover/focus opens the definition (fetches on first open). Click still opens sidebar.
 */
function StrongsClickableWord({
  code,
  children,
  className,
  onSelect,
}: {
  code: string
  children: React.ReactNode
  className?: string
  onSelect?: (code: string) => void
}) {
  const { getCached, getEntry } = useLexiconCache()
  const [entry, setEntry] = useState<StrongsEntry | null>(() => getCached(code))
  /** False until we know fetch outcome for the current hover (avoids flashing “not available” before load). */
  const [lexiconReady, setLexiconReady] = useState(() => !!getCached(code))

  useEffect(() => {
    const c = getCached(code)
    setEntry(c)
    setLexiconReady(!!c)
  }, [code, getCached])

  const handleOpenChange = useCallback(
    async (open: boolean) => {
      if (!open) {
        setLexiconReady(!!getCached(code))
        return
      }
      const cached = getCached(code)
      if (cached) {
        setEntry(cached)
        setLexiconReady(true)
        return
      }
      setEntry(null)
      setLexiconReady(false)
      const e = await getEntry(code)
      setEntry(e)
      setLexiconReady(true)
    },
    [code, getCached, getEntry],
  )

  const trigger = (
    <button
      type="button"
      onClick={() => onSelect?.(code)}
      className={className ? `${buttonClasses} ${className}` : buttonClasses}
      aria-label={`Word study: ${code}`}
    >
      {children}
    </button>
  )

  return (
    <HoverCard openDelay={200} closeDelay={100} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="top"
        sideOffset={6}
        className="w-[min(20rem,calc(100vw-2rem))] border-white/10 bg-[#0a0a0a] text-white shadow-xl [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20"
      >
        {entry ? (
          <WordStudyEntryContent entry={entry} showKjvAlignmentNote />
        ) : !lexiconReady ? (
          <span className="text-sm text-white/60">Loading…</span>
        ) : (
          <span className="text-sm text-white/60">Definition not available.</span>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Renders verse text. When wordsWithCodes is provided (KJV word+code pairs), each word is clickable with the correct Strong's code. Otherwise shows plain text.
 */
export function VerseWords({
  verseNumber: _verseNumber,
  text,
  wordsWithCodes,
  className = "",
  highlightStrongs = true,
  onSelectStrongs,
  footnotesForVerse,
}: VerseWordsProps) {
  if (wordsWithCodes && wordsWithCodes.length > 0) {
    return (
      <span className={className}>
        {wordsWithCodes.map(({ word, code }, i) => (
          <span key={`${i}-${code}`}>
            {i > 0 ? " " : null}
            <StrongsClickableWord
              code={code}
              onSelect={onSelectStrongs}
              className={
                highlightStrongs
                  ? "text-foreground border-b border-dashed border-amber-500/40 hover:border-amber-500/70"
                  : undefined
              }
            >
              {stripHtml(word)}
            </StrongsClickableWord>
          </span>
        ))}
      </span>
    )
  }

  return <VerseText text={text} className={className} footnotesByMarker={footnotesForVerse} />
}
