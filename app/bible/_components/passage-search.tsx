"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import type { BibleBook } from "@/lib/bible/types"

type PassageRow = {
  bookSlug: string
  chapterNumber: string
  verseRange: string
}

type PassageSearchProps = {
  initialRefs: string
  translationKey?: string | null
  books?: BibleBook[]
}

const emptyRow: PassageRow = {
  bookSlug: "",
  chapterNumber: "",
  verseRange: "",
}

export function PassageSearch({ initialRefs, translationKey, books = [] }: PassageSearchProps) {
  const router = useRouter()
  const [rawInput, setRawInput] = useState(initialRefs)
  const [rows, setRows] = useState<PassageRow[]>([emptyRow])

  const bookOptions = useMemo(
    () => books.map((book) => ({ label: book.name, value: book.slug })),
    [books]
  )

  const handleAddRow = () => {
    setRows((prev) => [...prev, emptyRow])
  }

  const handleRowChange = (index: number, key: keyof PassageRow, value: string) => {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  const buildFromRows = () => {
    if (bookOptions.length === 0) {
      return ""
    }
    const refs = rows
      .map((row) => {
        if (!row.bookSlug || !row.chapterNumber) {
          return ""
        }
        const bookLabel = bookOptions.find((book) => book.value === row.bookSlug)?.label ?? row.bookSlug
        const versePart = row.verseRange ? `:${row.verseRange.trim()}` : ""
        return `${bookLabel} ${row.chapterNumber.trim()}${versePart}`
      })
      .filter(Boolean)
    return refs.join("; ")
  }

  const handleSearch = () => {
    const builtRefs = buildFromRows()
    const finalRefs = builtRefs || rawInput.trim()
    const params = new URLSearchParams()
    if (finalRefs) {
      params.set("refs", finalRefs)
    }
    if (translationKey) {
      params.set("t", translationKey)
    }
    router.push(`/bible/search?${params.toString()}`)
  }

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card/60 p-6">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Search by reference
        </h2>
        <textarea
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          placeholder="Example: John 3:16-18; Romans 8:1"
          className="min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>

      {bookOptions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Passage builder
          </h3>
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[1fr_120px_140px]">
                <select
                  value={row.bookSlug}
                  onChange={(event) => handleRowChange(index, "bookSlug", event.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <option value="">Select book</option>
                  {bookOptions.map((book) => (
                    <option key={book.value} value={book.value}>
                      {book.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  placeholder="Chapter"
                  value={row.chapterNumber}
                  onChange={(event) => handleRowChange(index, "chapterNumber", event.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                <input
                  type="text"
                  placeholder="Verses (e.g. 1-5)"
                  value={row.verseRange}
                  onChange={(event) => handleRowChange(index, "verseRange", event.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent"
          >
            + Add another passage
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleSearch}
        className="w-full rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-accent transition hover:border-accent/60 hover:bg-accent/20"
      >
        Search scripture
      </button>
    </div>
  )
}
