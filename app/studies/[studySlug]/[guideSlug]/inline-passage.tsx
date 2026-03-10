"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getReaderUrlFromReference } from "@/lib/bible/reference"
import { VerseText } from "@/lib/bible/verse-text"
import { BookOpen, Loader2 } from "lucide-react"

interface InlinePassageProps {
  passageRef: string
}

type State =
  | { status: "loading" }
  | { status: "loaded"; reference: string; translation: string; verses: { number: number; text: string }[]; emptyMessage?: string }
  | { status: "error"; message: string }

export function InlinePassage({ passageRef: refStr }: InlinePassageProps) {
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    if (!refStr || typeof refStr !== "string") return
    let cancelled = false
    const params = new URLSearchParams({ ref: refStr })
    fetch(`/api/bible/passage?${params.toString()}`)
      .then((res) =>
        res.json().then((data: { reference?: string; translation?: string; verses?: { number: number; text: string }[]; error?: string }) => ({
          ok: res.ok,
          data,
        }))
      )
      .then(({ ok, data }) => {
        if (cancelled) return
        const verses = data.verses ?? []
        if (!ok && data.error) {
          setState({ status: "error", message: data.error })
          return
        }
        setState({
          status: "loaded",
          reference: data.reference ?? refStr,
          translation: data.translation ?? "",
          verses,
          emptyMessage: verses.length === 0 ? (data.error ?? "No verses in this range.") : undefined,
        })
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Unable to load passage." })
      })
    return () => {
      cancelled = true
    }
  }, [refStr])

  const readerUrl = refStr ? getReaderUrlFromReference(refStr) : null

  if (state.status === "loading") {
    return (
      <span className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-4 sm:px-2 sm:py-1">
        <Loader2 className="size-4 sm:size-3 animate-spin text-accent" />
        <span className="font-mono text-xs text-muted-foreground">{refStr || "Loading…"}</span>
      </span>
    )
  }

  if (state.status === "error") {
    return (
      <span className="block rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 sm:px-2 sm:py-1" title={state.message}>
        <span className="font-mono text-xs text-destructive">{refStr || "Passage"}</span>
        <span className="block sm:inline sm:ml-1 text-xs text-destructive/70 mt-0.5 sm:mt-0">Passage unavailable</span>
      </span>
    )
  }

  return (
    <span className="my-2 block rounded-lg border border-border bg-card/60 py-3 sm:py-3 pl-4 pr-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] tracking-widest text-accent">{state.reference}</p>
        {state.translation && (
          <span className="text-[10px] text-muted-foreground shrink-0">{state.translation}</span>
        )}
      </div>
      {state.verses.length > 0 ? (
        <ol className="mt-3 space-y-2 text-[0.9375rem] sm:text-sm leading-relaxed text-foreground">
          {state.verses.map((v) => (
            <li key={v.number} className="flex gap-2">
              <span className="shrink-0 font-mono text-[10px] font-bold text-muted-foreground mt-1 select-none">{v.number}</span>
              <VerseText text={v.text} className="leading-[1.7]" />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground italic" title={state.emptyMessage}>
          {state.emptyMessage ?? "No verses in this range."}
        </p>
      )}
      {readerUrl && (
        <Link
          href={readerUrl}
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-accent hover:underline active:text-amber-200 min-h-[36px] sm:min-h-0"
        >
          <BookOpen className="size-3" />
          Open in reader
        </Link>
      )}
    </span>
  )
}
