"use client"

import { useEffect } from "react"
import type { StrongsLoadTrace } from "@/lib/bible/verse-strongs"

/**
 * Mirrors server Strong's diagnostics to the browser console and shows an on-page panel
 * when BIBLE_STRONGS_DEBUG=1 (set on the server; trace is only passed then).
 */
export function StrongsDebugPanel({ trace }: { trace: StrongsLoadTrace }) {
  useEffect(() => {
    console.info("[strongs] server trace", trace)
    if (trace.hints.length > 0) {
      console.warn("[strongs] hints (see server logs for full [strongs] lines)", trace.hints)
    }
    if (!trace.chapterFound || trace.verseCount === 0) {
      console.warn("[strongs] no verse-level Strong's data for this chapter", {
        chapterKey: trace.chapterKey,
        chapterFound: trace.chapterFound,
        verseCount: trace.verseCount,
        fetchAttempts: trace.fetchAttempts,
      })
    }
  }, [trace])

  return (
    <details className="rounded-md border border-amber-500/40 bg-amber-500/5 text-left">
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-mono text-amber-700 dark:text-amber-200/90">
        Strong&apos;s debug
      </summary>
      <pre className="max-h-64 overflow-auto border-t border-amber-500/20 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
        {JSON.stringify(trace, null, 2)}
      </pre>
    </details>
  )
}
