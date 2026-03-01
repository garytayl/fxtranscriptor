/**
 * Devotions local storage — versioned key so we can migrate data later.
 * No sign-in; data stays in this browser only. Export backup recommended.
 */

export const DEVOTIONS_STORAGE_KEY = "fx_devotions_v1"

export type DevotionEntry = {
  id: string
  createdAt: string // ISO
  title: string
  body: string
}

export type DevotionsData = {
  version: 1
  entries: DevotionEntry[]
}

const defaultData: DevotionsData = { version: 1, entries: [] }

function safeParse(raw: string | null): DevotionsData {
  if (!raw) return defaultData
  try {
    const parsed = JSON.parse(raw) as DevotionsData
    if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
      return parsed
    }
  } catch {
    // ignore
  }
  return defaultData
}

export function getDevotionsFromStorage(): DevotionsData {
  if (typeof window === "undefined") return defaultData
  return safeParse(window.localStorage.getItem(DEVOTIONS_STORAGE_KEY))
}

export function saveDevotionsToStorage(data: DevotionsData): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DEVOTIONS_STORAGE_KEY, JSON.stringify(data))
}

export function createEntry(entry: Omit<DevotionEntry, "id" | "createdAt">): DevotionEntry {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: entry.title,
    body: entry.body,
  }
}

// ——— Passage-of-the-day: prayer + reflection per passage ref ———

const PASSAGE_STORAGE_PREFIX = "fx_devotions_v1_passage_"

/** Slug for localStorage key from passage ref (e.g. "John 3:16-21" → "john-3-16-21"). */
export function slugifyPassageRef(ref: string): string {
  return ref
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/:/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export type PassageEntry = { prayer: string; reflection: string }

export function getPassageEntry(ref: string): PassageEntry {
  if (typeof window === "undefined") return { prayer: "", reflection: "" }
  try {
    const raw = window.localStorage.getItem(`${PASSAGE_STORAGE_PREFIX}${slugifyPassageRef(ref)}`)
    if (!raw) return { prayer: "", reflection: "" }
    const parsed = JSON.parse(raw) as { prayer?: string; reflection?: string }
    return { prayer: parsed.prayer ?? "", reflection: parsed.reflection ?? "" }
  } catch {
    return { prayer: "", reflection: "" }
  }
}

export function savePassageEntry(ref: string, data: PassageEntry): void {
  if (typeof window === "undefined") return
  try {
    const payload = {
      ...data,
      passageRef: ref,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(
      `${PASSAGE_STORAGE_PREFIX}${slugifyPassageRef(ref)}`,
      JSON.stringify(payload)
    )
  } catch {
    // ignore
  }
}

/** Best-effort display label from storage key (e.g. "john-3-16-21" → "John 3 16 21"). */
function humanizePassageKey(key: string): string {
  const slug = key.startsWith(PASSAGE_STORAGE_PREFIX)
    ? key.slice(PASSAGE_STORAGE_PREFIX.length)
    : key
  if (!slug) return "Unknown passage"
  const words = slug.split("-")
  if (words.length > 0) words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1)
  return words.join(" ").replace(/\s(\d+)\s(\d+)\s(\d+)/, " $1:$2-$3").replace(/\s(\d+)\s(\d+)/g, " $1:$2")
}

export type ListedPassageEntry = {
  passageRef: string
  prayer: string
  reflection: string
  updatedAt: string | null
}

export function listPassageEntries(): ListedPassageEntry[] {
  if (typeof window === "undefined") return []
  const entries: ListedPassageEntry[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key?.startsWith(PASSAGE_STORAGE_PREFIX)) continue
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as {
        prayer?: string
        reflection?: string
        passageRef?: string
        updatedAt?: string
      }
      const passageRef = parsed.passageRef ?? humanizePassageKey(key)
      const prayer = parsed.prayer ?? ""
      const reflection = parsed.reflection ?? ""
      const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : null
      if (!prayer && !reflection) continue
      entries.push({ passageRef, prayer, reflection, updatedAt })
    } catch {
      // skip malformed
    }
  }
  entries.sort((a, b) => {
    if (!a.updatedAt) return 1
    if (!b.updatedAt) return -1
    return b.updatedAt.localeCompare(a.updatedAt)
  })
  return entries
}
