const GREEK_WORD_MEMORY_KEY = "fx_devotions_greek_v1_word_memory"
const MAX_TRACKED_WORD_FORMS = 5000
const MAX_WEAK_SCORE = 8

export type GreekWordMemoryEntry = {
  taps: number
  recognized: number
  weakScore: number
  lastSeenAt: string
}

export type GreekWordMemory = Record<string, GreekWordMemoryEntry>

export type GreekWordMemoryTapStatus = "new" | "recognized" | "learning"

export type GreekWordMemoryTapResult = {
  memory: GreekWordMemory
  entry: GreekWordMemoryEntry
  status: GreekWordMemoryTapStatus
}

function toFiniteInt(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

function normalizeEntry(value: unknown): GreekWordMemoryEntry | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<GreekWordMemoryEntry>
  const taps = toFiniteInt(raw.taps)
  const recognized = Math.min(taps, toFiniteInt(raw.recognized))
  const weakScore = Math.min(MAX_WEAK_SCORE, toFiniteInt(raw.weakScore))
  const lastSeenAt = typeof raw.lastSeenAt === "string" ? raw.lastSeenAt : ""
  return {
    taps,
    recognized,
    weakScore,
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

export function saveGreekWordMemory(memory: GreekWordMemory): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(GREEK_WORD_MEMORY_KEY, JSON.stringify(memory))
}

function pruneWordMemory(memory: GreekWordMemory): GreekWordMemory {
  const entries = Object.entries(memory)
  if (entries.length <= MAX_TRACKED_WORD_FORMS) return memory
  entries.sort((a, b) => Date.parse(b[1].lastSeenAt || "") - Date.parse(a[1].lastSeenAt || ""))
  return Object.fromEntries(entries.slice(0, MAX_TRACKED_WORD_FORMS))
}

export function updateGreekWordMemory(
  memory: GreekWordMemory,
  wordFormKey: string,
  recognizedTap: boolean,
): GreekWordMemoryTapResult {
  const key = wordFormKey.trim()
  if (!key) {
    return {
      memory,
      entry: { taps: 0, recognized: 0, weakScore: 0, lastSeenAt: "" },
      status: "learning",
    }
  }
  const current = memory[key] ?? { taps: 0, recognized: 0, weakScore: 0, lastSeenAt: "" }
  const taps = current.taps + 1
  const recognized = Math.min(taps, current.recognized + (recognizedTap ? 1 : 0))
  const weakDelta = recognizedTap ? -1 : 1
  const weakScore = Math.max(0, Math.min(MAX_WEAK_SCORE, current.weakScore + weakDelta))
  const status: GreekWordMemoryTapStatus = recognizedTap ? "recognized" : taps === 1 ? "new" : "learning"
  const entry: GreekWordMemoryEntry = {
    taps,
    recognized,
    weakScore,
    lastSeenAt: new Date().toISOString(),
  }
  const next = pruneWordMemory({
    ...memory,
    [key]: entry,
  })
  saveGreekWordMemory(next)
  return { memory: next, entry, status }
}

export function getWeakWordForms(memory: GreekWordMemory, minWeakScore = 2): Set<string> {
  const out = new Set<string>()
  for (const [key, entry] of Object.entries(memory)) {
    if (entry.weakScore >= minWeakScore) out.add(key)
  }
  return out
}

export function recordGreekWordMemoryTap(wordFormKey: string): GreekWordMemoryTapResult {
  const current = getGreekWordMemory()
  const previousEntry = current[wordFormKey]
  const recognizedTap = Boolean(previousEntry && previousEntry.taps > 0)
  return updateGreekWordMemory(current, wordFormKey, recognizedTap)
}

export function buildWeakWordSet(memory: GreekWordMemory, minWeakScore = 2): Set<string> {
  return getWeakWordForms(memory, minWeakScore)
}

