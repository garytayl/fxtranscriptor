/**
 * Local-only cursor per series: which passage index to show next (0-based).
 * Daily series does not use storage.
 */

import { DAILY_SERIES_ID } from "@/lib/meditation-series"

const STORAGE_KEY = "fx_meditation_series_progress_v1"

type Store = Record<string, number>

function readStore(): Store {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as Store
    return typeof p === "object" && p !== null && !Array.isArray(p) ? p : {}
  } catch {
    return {}
  }
}

function writeStore(s: Store): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

/** Next passage index to load for this series (clamped when applied). */
export function getMeditationPassageIndex(seriesId: string): number {
  if (seriesId === DAILY_SERIES_ID) return 0
  const store = readStore()
  const v = store[seriesId]
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

/** After finishing a meditation, advance to the next passage in the series. */
export function advanceMeditationPassageIndex(seriesId: string, passageCount: number): void {
  if (seriesId === DAILY_SERIES_ID || passageCount <= 0) return
  const store = readStore()
  const cur = getMeditationPassageIndex(seriesId)
  store[seriesId] = (cur + 1) % passageCount
  writeStore(store)
}
