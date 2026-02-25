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
