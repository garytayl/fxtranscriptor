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
    <div className="flex flex-col gap-1 text-left">
      <label htmlFor="chapter-jump" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Jump to chapter
      </label>
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
        className="h-10 min-w-[140px] rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        aria-label="Jump to chapter"
      >
        {chapters.map((chapter) => (
          <option key={chapter.number} value={chapter.number}>
            Chapter {chapter.number}
          </option>
        ))}
      </select>
    </div>
  )
}
