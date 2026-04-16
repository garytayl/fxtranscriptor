"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  filterAndSortWordMemoryRows,
  getGreekWordMemory,
  getWordFamiliarityLabel,
  listGreekWordMemoryRows,
  type GreekWordMemoryRow,
  type WordBankFilter,
  type WordBankSort,
} from "@/lib/devotions-greek-word-memory"
import { cn } from "@/lib/utils"

type Accent = "emerald" | "amber"

const FILTER_OPTIONS: { id: WordBankFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "In progress" },
  { id: "learned", label: "Learned" },
  { id: "weak", label: "Review" },
]

const SORT_OPTIONS: { id: WordBankSort; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "weak", label: "Weakest" },
  { id: "lemma", label: "Lemma" },
]

function formatParseBrief(parse: string): string {
  const p = parse.trim()
  if (p.length <= 10) return p
  return `${p.slice(0, 10)}…`
}

function formatSeenAt(iso: string): string {
  if (!iso) return "—"
  const d = Date.parse(iso)
  if (Number.isNaN(d)) return "—"
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function GreekWordBankPanel({
  accent,
  className,
}: {
  accent: Accent
  className?: string
}) {
  const [rows, setRows] = useState<GreekWordMemoryRow[]>(() => listGreekWordMemoryRows(getGreekWordMemory()))
  const [filter, setFilter] = useState<WordBankFilter>("all")
  const [sort, setSort] = useState<WordBankSort>("recent")
  const [query, setQuery] = useState("")

  const refresh = useCallback(() => {
    setRows(listGreekWordMemoryRows(getGreekWordMemory()))
  }, [])

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "fx_devotions_greek_v1_word_memory") refresh()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refresh])

  const filtered = useMemo(() => {
    const base = filterAndSortWordMemoryRows(rows, filter, sort)
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter((r) => {
      const lemma = r.lemma.toLowerCase()
      const parse = r.parse.toLowerCase()
      return lemma.includes(q) || parse.includes(q) || r.formKey.toLowerCase().includes(q)
    })
  }, [rows, filter, sort, query])

  const chipOn =
    accent === "emerald"
      ? "border-emerald-400/45 bg-emerald-500/18 text-emerald-100"
      : "border-amber-400/45 bg-amber-500/18 text-amber-100"
  const chipOff = "border-white/14 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
              filter === opt.id ? chipOn : chipOff,
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="greek-word-bank-search">
          Search lemmas or parsing codes
        </label>
        <input
          id="greek-word-bank-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lemma or parse…"
          className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 font-sans text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSort(opt.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                sort === opt.id ? chipOn : chipOff,
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <p className="font-mono text-[10px] text-white/45">
        {filtered.length} form{filtered.length !== 1 ? "s" : ""}
        {rows.length > 0 ? ` · ${rows.length} tracked total` : ""}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/55 leading-relaxed">
          Word forms appear here as you practice in Verse Quest (quiz taps). Open a passage in the quest and tap target words to build this list.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li
              key={r.formKey}
              className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 sm:px-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span lang="el" className="text-lg font-light text-amber-100/95">
                  {r.lemma || "—"}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                    r.familiarity === "learned"
                      ? "border-emerald-400/35 text-emerald-200/90"
                      : r.familiarity === "seen"
                        ? "border-cyan-400/35 text-cyan-200/85"
                        : "border-white/20 text-white/55",
                  )}
                >
                  {getWordFamiliarityLabel(r.familiarity)}
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-white/50">
                Parse <span className="text-white/70">{formatParseBrief(r.parse)}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-white/40">
                <span>
                  Quiz {r.correct}/{r.taps} correct
                </span>
                {r.weakScore > 0 ? <span>Review weight {r.weakScore}</span> : null}
                <span>Seen {formatSeenAt(r.lastSeenAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && filtered.length === 0 ? (
        <p className="text-center text-sm text-white/50">No words match this filter or search.</p>
      ) : null}
    </div>
  )
}
