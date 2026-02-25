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
    window.localStorage.setItem(
      `${PASSAGE_STORAGE_PREFIX}${slugifyPassageRef(ref)}`,
      JSON.stringify(data)
    )
  } catch {
    // ignore
  }
}
