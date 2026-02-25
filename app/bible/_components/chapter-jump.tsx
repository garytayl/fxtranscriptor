"use client"

import { useRouter } from "next/navigation"

type ChapterOption = {
  number: number
}

type ChapterJumpProps = {
  bookSlug: string
  chapters: ChapterOption[]
  currentChapter: number
  translationKey?: string | null
}

export function ChapterJump({ bookSlug, chapters, currentChapter, translationKey }: ChapterJumpProps) {
  const router = useRouter()

  return (
    <select
      id="chapter-jump"
      value={currentChapter}
      onChange={(event) => {
        const params = new URLSearchParams()
        if (translationKey) {
          params.set("t", translationKey)
        }
        const query = params.toString()
        router.push(`/bible/${bookSlug}/${event.target.value}${query ? `?${query}` : ""}`)
      }}
      className="h-9 sm:h-10 min-w-[100px] sm:min-w-[140px] rounded-md border border-border bg-background px-2 sm:px-3 text-xs sm:text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      aria-label="Jump to chapter"
    >
      {chapters.map((chapter) => (
        <option key={chapter.number} value={chapter.number}>
          Ch. {chapter.number}
        </option>
      ))}
    </select>
  )
}
