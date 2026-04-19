"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, ChevronDown, ChevronRight, Copy, Search } from "lucide-react"

import type { StrongsEntry } from "@/lib/bible/lexicon"
import { searchGreekLemmasByEnglish, type GreekLemmaEnglishHit } from "@/lib/greek-english-lemma-search"

function LexiconPeek({ code }: { code: string }) {
  const [entry, setEntry] = useState<StrongsEntry | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setEntry(null)
    void fetch(`/api/bible/lexicon/${encodeURIComponent(code)}`)
      .then((r) => r.json() as Promise<StrongsEntry>)
      .then((j) => {
        if (!cancelled) {
          setEntry(j)
          setStatus("idle")
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [code])

  if (status === "loading") {
    return <p className="font-mono text-[10px] text-white/45">Loading lexicon…</p>
  }
  if (status === "error" || !entry) {
    return <p className="font-mono text-[10px] text-amber-200/80">Could not load definition.</p>
  }

  return (
    <div className="space-y-1.5 border-t border-white/10 pt-2 font-mono text-[11px] leading-relaxed text-white/75">
      {entry.transliteration ? (
        <p className="text-violet-200/85">
          <span className="text-white/45">Transliteration · </span>
          {entry.transliteration}
        </p>
      ) : null}
      <p className="text-emerald-100/90">{entry.meaning}</p>
      {entry.definition ? <p className="text-white/60">{entry.definition}</p> : null}
    </div>
  )
}

function HitRow({ hit }: { hit: GreekLemmaEnglishHit }) {
  const [open, setOpen] = useState(false)
  const code = hit.strongsCode

  const copyLemma = useCallback(() => {
    void navigator.clipboard?.writeText(hit.lemma)
  }, [hit.lemma])

  return (
    <li className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p lang="el" className="text-lg text-amber-100/95">
            {hit.lemma}
          </p>
          <p className="mt-0.5 font-mono text-[11px] leading-snug text-white/60">{hit.gloss}</p>
          {code ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-violet-300/80">Strong&apos;s {code}</p>
          ) : (
            <p className="mt-1 font-mono text-[10px] text-white/40">No Strong&apos;s index for this lemma</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <button
            type="button"
            onClick={copyLemma}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/30 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/70 hover:bg-white/[0.08]"
          >
            <Copy className="size-3 opacity-70" aria-hidden />
            Copy
          </button>
          {code ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-400/35 bg-violet-500/12 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-violet-100 hover:bg-violet-500/20"
            >
              {open ? <ChevronDown className="size-3" aria-hidden /> : <ChevronRight className="size-3" aria-hidden />}
              Lexicon
            </button>
          ) : null}
        </div>
      </div>
      {open && code ? (
        <div className="mt-2">
          <LexiconPeek code={code} />
        </div>
      ) : null}
    </li>
  )
}

export function GreekEnglishLemmaSearchPanel() {
  const [rawQuery, setRawQuery] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(rawQuery.trim()), 220)
    return () => window.clearTimeout(t)
  }, [rawQuery])

  const hits = useMemo(() => searchGreekLemmasByEnglish(debounced, { limit: 120 }), [debounced])

  return (
    <div className="space-y-5">
      <label className="block space-y-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
          Type English to find Greek words (lemma search)
        </span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-emerald-400/55" aria-hidden />
          <input
            type="search"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="e.g. love, faith, holy spirit"
            autoComplete="off"
            className="w-full rounded-2xl border border-white/15 bg-black/35 py-3 pl-10 pr-4 font-mono text-sm text-white placeholder:text-white/35 focus:border-emerald-400/45 focus:outline-none"
            aria-label="Search Greek lemmas by English meaning"
          />
        </div>
      </label>

      <p className="font-mono text-[10px] leading-relaxed text-white/45">
        Matches are drawn from short Strong&apos;s-based glosses used in Verse Quest—useful for vocabulary study, not
        exhaustive semantic ranges. Try different English words if a lemma you expect is missing.
      </p>

      {debounced.length >= 2 ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-200/70">
          {hits.length} result{hits.length === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="font-mono text-[10px] text-white/40">Type at least two letters.</p>
      )}

      {hits.length > 0 ? (
        <ul className="space-y-2">
          {hits.map((hit) => (
            <HitRow key={hit.lemma} hit={hit} />
          ))}
        </ul>
      ) : debounced.length >= 2 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-4 text-center font-mono text-sm text-white/55">
          No lemmas matched. Try a shorter root (e.g. &quot;lov&quot;) or a synonym.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <Link
          href="/devotions/greek/reader"
          className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-100 hover:bg-amber-500/18"
        >
          <BookOpen className="size-3.5 opacity-80" aria-hidden />
          Grammar reader
        </Link>
        <Link
          href="/devotions/greek/words"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/75 hover:bg-white/[0.08]"
        >
          Word bank
        </Link>
      </div>
    </div>
  )
}
