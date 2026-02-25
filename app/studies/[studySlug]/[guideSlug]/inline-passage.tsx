"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getReaderUrlFromReference } from "@/lib/bible/reference"
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
      <span className="inline-flex items-center gap-1.5 rounded border border-border bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {refStr || "…"}
      </span>
    )
  }

  if (state.status === "error") {
    return (
      <span className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1 font-mono text-xs text-destructive" title={state.message}>
        {refStr || "Passage"} (unavailable)
      </span>
    )
  }

  return (
    <span className="my-2 block rounded-lg border border-border bg-card/60 py-3 pl-4 pr-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">{state.reference}</p>
        {state.translation && (
          <span className="text-[10px] text-muted-foreground">{state.translation}</span>
        )}
      </div>
      {state.verses.length > 0 ? (
        <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground">
          {state.verses.map((v) => (
            <li key={v.number} className="flex gap-2">
              <span className="shrink-0 font-mono text-[10px] font-semibold text-muted-foreground align-super">{v.number}</span>
              <span>{v.text}</span>
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
          className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-accent hover:underline"
        >
          <BookOpen className="size-3" />
          Open in reader
        </Link>
      )}
    </span>
  )
}
