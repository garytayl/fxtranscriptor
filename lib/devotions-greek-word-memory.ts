const GREEK_WORD_MEMORY_KEY = "fx_devotions_greek_v1_word_memory"
const MAX_TRACKED_WORD_FORMS = 5000
const MAX_WEAK_SCORE = 12

export type GreekWordFamiliarity = "new" | "seen" | "learned"

export type GreekWordMemoryEntry = {
  taps: number
  correct: number
  weakScore: number
  familiarity: GreekWordFamiliarity
  lastSeenAt: string
}

export type GreekWordMemory = Record<string, GreekWordMemoryEntry>

export type GreekWordMemoryTapResult = {
  memory: GreekWordMemory
  entry: GreekWordMemoryEntry
  previouslySeen: boolean
}

function toFiniteInt(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

function normalizeEntry(value: unknown): GreekWordMemoryEntry | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<GreekWordMemoryEntry>
  const taps = toFiniteInt(raw.taps)
  const correct = Math.min(taps, toFiniteInt(raw.correct))
  const weakScore = Math.min(MAX_WEAK_SCORE, toFiniteInt(raw.weakScore))
  const familiarity: GreekWordFamiliarity =
    raw.familiarity === "learned" || raw.familiarity === "seen" ? raw.familiarity : "new"
  const lastSeenAt = typeof raw.lastSeenAt === "string" ? raw.lastSeenAt : ""
  return {
    taps,
    correct,
    weakScore,
    familiarity,
    lastSeenAt,
  }
}

export function parseGreekWordMemory(raw: string | null): GreekWordMemory {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== "object") return {}
    const entries = Object.entries(parsed).slice(0, MAX_TRACKED_WORD_FORMS)
    const out: GreekWordMemory = {}
    for (const [key, value] of entries) {
      if (!key) continue
      const normalized = normalizeEntry(value)
      if (normalized) out[key] = normalized
    }
    return out
  } catch {
    return {}
  }
}

export function getGreekWordMemory(): GreekWordMemory {
  if (typeof window === "undefined") return {}
  return parseGreekWordMemory(window.localStorage.getItem(GREEK_WORD_MEMORY_KEY))
}

function saveGreekWordMemory(memory: GreekWordMemory): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(GREEK_WORD_MEMORY_KEY, JSON.stringify(memory))
}

function pruneWordMemory(memory: GreekWordMemory): GreekWordMemory {
  const entries = Object.entries(memory)
  if (entries.length <= MAX_TRACKED_WORD_FORMS) return memory
  entries.sort((a, b) => Date.parse(b[1].lastSeenAt || "") - Date.parse(a[1].lastSeenAt || ""))
  return Object.fromEntries(entries.slice(0, MAX_TRACKED_WORD_FORMS))
}

function familiarityFromStats(taps: number, correct: number): GreekWordFamiliarity {
  if (correct >= 3 && correct / Math.max(1, taps) >= 0.75) return "learned"
  if (taps >= 2 || correct >= 1) return "seen"
  return "new"
}

export function recordGreekWordMemoryTap(wordFormKey: string, wasCorrect: boolean): GreekWordMemoryTapResult {
  const key = wordFormKey.trim()
  if (!key) {
    const fallback: GreekWordMemoryEntry = {
      taps: 0,
      correct: 0,
      weakScore: 0,
      familiarity: "new",
      lastSeenAt: "",
    }
    return { memory: getGreekWordMemory(), entry: fallback, previouslySeen: false }
  }

  const current = getGreekWordMemory()
  const existing = current[key]
  const nextTaps = (existing?.taps ?? 0) + 1
  const nextCorrect = Math.min(nextTaps, (existing?.correct ?? 0) + (wasCorrect ? 1 : 0))
  const weakDelta = wasCorrect ? -2 : 2
  const nextWeakScore = Math.max(0, Math.min(MAX_WEAK_SCORE, (existing?.weakScore ?? 0) + weakDelta))
  const entry: GreekWordMemoryEntry = {
    taps: nextTaps,
    correct: nextCorrect,
    weakScore: nextWeakScore,
    familiarity: familiarityFromStats(nextTaps, nextCorrect),
    lastSeenAt: new Date().toISOString(),
  }

  const next = pruneWordMemory({
    ...current,
    [key]: entry,
  })
  saveGreekWordMemory(next)
  return {
    memory: next,
    entry,
    previouslySeen: Boolean(existing && existing.taps > 0),
  }
}

export function buildWeakWordSet(memory: GreekWordMemory, minWeakScore = 3): Set<string> {
  const out = new Set<string>()
  for (const [key, entry] of Object.entries(memory)) {
    if (entry.weakScore >= minWeakScore) out.add(key)
  }
  return out
}

export function getWordFamiliarityLabel(familiarity: GreekWordFamiliarity): string {
  if (familiarity === "learned") return "Learned"
  if (familiarity === "seen") return "Seen"
  return "New"
}

/** One tracked word form: key is `lemma|parse` (see wordFormKey in verse UI). */
export type GreekWordMemoryRow = {
  formKey: string
  lemma: string
  parse: string
  taps: number
  correct: number
  weakScore: number
  familiarity: GreekWordFamiliarity
  lastSeenAt: string
}

export function splitWordFormKey(formKey: string): { lemma: string; parse: string } {
  const i = formKey.indexOf("|")
  if (i < 0) return { lemma: formKey.trim(), parse: "" }
  return { lemma: formKey.slice(0, i).trim(), parse: formKey.slice(i + 1).trim() }
}

export function listGreekWordMemoryRows(memory: GreekWordMemory): GreekWordMemoryRow[] {
  return Object.entries(memory).map(([formKey, e]) => {
    const { lemma, parse } = splitWordFormKey(formKey)
    return {
      formKey,
      lemma,
      parse,
      taps: e.taps,
      correct: e.correct,
      weakScore: e.weakScore,
      familiarity: e.familiarity,
      lastSeenAt: e.lastSeenAt,
    }
  })
}

export type WordBankSort = "recent" | "weak" | "lemma"
export type WordBankFilter = "all" | "active" | "learned" | "weak"

export function filterAndSortWordMemoryRows(
  rows: GreekWordMemoryRow[],
  filter: WordBankFilter,
  sort: WordBankSort,
): GreekWordMemoryRow[] {
  let out = rows
  if (filter === "active") {
    out = rows.filter((r) => r.familiarity !== "learned")
  } else if (filter === "learned") {
    out = rows.filter((r) => r.familiarity === "learned")
  } else if (filter === "weak") {
    out = rows.filter((r) => r.weakScore >= 4 || (r.familiarity !== "learned" && r.taps >= 1))
  }
  const copy = [...out]
  if (sort === "recent") {
    copy.sort((a, b) => Date.parse(b.lastSeenAt || "0") - Date.parse(a.lastSeenAt || "0"))
  } else if (sort === "weak") {
    copy.sort((a, b) => b.weakScore - a.weakScore || b.taps - a.taps)
  } else {
    copy.sort((a, b) => a.lemma.localeCompare(b.lemma, "el") || a.parse.localeCompare(b.parse))
  }
  return copy
}
