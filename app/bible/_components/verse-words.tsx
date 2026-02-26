"use client"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { WordStudyEntryContent } from "@/components/word-study"
import { useLexiconCache } from "@/app/bible/_components/lexicon-cache-context"

type VerseWordsProps = {
  verseNumber: number
  text: string
  /** Strong's codes in word order (from KJV alignment). Word at index i gets strongs[i] if present. */
  strongs?: string[]
  className?: string
  /** When true, words with Strong's get hover styling. */
  highlightStrongs?: boolean
  /** Called when a word with Strong's is clicked (e.g. to show in sidebar). Definition is fetched on click only. */
  onSelectStrongs?: (code: string) => void
}

const buttonClasses =
  "cursor-pointer border-b border-dashed border-amber-500/50 font-medium text-amber-200/90 hover:border-amber-500/80 hover:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 rounded-sm"

/**
 * Clickable word with Strong's code. Definition loads in sidebar on click. If already in cache, hover shows definition.
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
  const { getCached } = useLexiconCache()
  const cached = getCached(code)

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

  if (cached) {
    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
        <HoverCardContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-[min(20rem,calc(100vw-2rem))] border-white/10 bg-[#0a0a0a] text-white shadow-xl [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20"
        >
          <WordStudyEntryContent entry={cached} />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return trigger
}

/**
 * Splits verse text into words and renders each word; words with a Strong's code are clickable (definition loads in sidebar on click, no hover fetch).
 */
export function VerseWords({
  verseNumber,
  text,
  strongs = [],
  className = "",
  highlightStrongs = true,
  onSelectStrongs,
}: VerseWordsProps) {
  const words = text.split(/(\s+)/)
  const tokens: { type: "word" | "space"; value: string; index: number }[] = []
  let wordIndex = 0
  for (const w of words) {
    if (/^\s+$/.test(w)) {
      tokens.push({ type: "space", value: w, index: -1 })
    } else if (w) {
      tokens.push({ type: "word", value: w, index: wordIndex++ })
    }
  }

  return (
    <span className={className}>
      {tokens.map((t, i) => {
        if (t.type === "space") return <span key={i}>{t.value}</span>
        const code = strongs[t.index]
        if (code) {
          return (
            <StrongsClickableWord
              key={i}
              code={code}
              onSelect={onSelectStrongs}
              className={
                highlightStrongs
                  ? "text-foreground border-b border-dashed border-amber-500/40 hover:border-amber-500/70"
                  : undefined
              }
            >
              {t.value}
            </StrongsClickableWord>
          )
        }
        return <span key={i}>{t.value}</span>
      })}
    </span>
  )
}
