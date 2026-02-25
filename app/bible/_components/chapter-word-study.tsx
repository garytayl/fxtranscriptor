"use client"

import Link from "next/link"
import { WordStudy } from "@/components/word-study"

type ChapterWordStudyProps = {
  bookSlug: string
  chapterNumber: number
  keyTerms: string[]
}

export function ChapterWordStudy({ bookSlug, chapterNumber, keyTerms }: ChapterWordStudyProps) {
  if (keyTerms.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card/50 px-4 py-3 sm:px-4 sm:py-4">
        <h2 className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Dive deeper
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          In our{" "}
          <Link href="/studies" className="text-accent hover:underline">
            study guides
          </Link>
          , you can hover over Greek and Hebrew word links (e.g. <em>agapē</em>, <em>pisteuō</em>) to see Strong’s definitions and dive deeper into the text.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-card/50 px-4 py-3 sm:px-4 sm:py-4">
      <h2 className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
        Dive deeper — key terms
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
        Hover or tap a word below to see the original Greek or Hebrew and a short definition (Strong’s Concordance). More word studies are in our{" "}
        <Link href="/studies" className="text-accent hover:underline">
          study guides
        </Link>
        .
      </p>
      <div className="flex flex-wrap gap-2">
        {keyTerms.map((code) => (
          <WordStudy key={code} code={code} className="text-accent" />
        ))}
      </div>
    </section>
  )
}
