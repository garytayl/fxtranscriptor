import { BIBLE_QUEST_TRACK_STORAGE_KEY } from "@/lib/quest-bible-series"
import { GREEK_UI_PREFS_STORAGE_KEY } from "@/lib/devotions-greek-ui-preferences"

/** Must match `DAILY_VERSE_RUN_STATE_KEY` in greek-verse-quest-logic.ts */
const DAILY_VERSE_RUN_STATE_KEY = "fx_devotions_greek_v1_daily_run_state"

/** Bump when the backup shape changes. */
export const GREEK_BACKUP_VERSION = 2 as const

/** All localStorage keys included in export / reset (single source for danger zone). */
export const GREEK_BACKUP_STORAGE_KEYS = {
  progress: "fx_devotions_greek_v1_progress",
  place: "fx_devotions_greek_place_v1",
  uiPrefs: GREEK_UI_PREFS_STORAGE_KEY,
  wordMemory: "fx_devotions_greek_v1_word_memory",
  dailyRun: DAILY_VERSE_RUN_STATE_KEY,
  endingsLab: "fx_devotions_greek_endings_lab_v1",
  questTrack: BIBLE_QUEST_TRACK_STORAGE_KEY,
} as const

export type GreekBackupPayloadV1 = {
  version: typeof GREEK_BACKUP_VERSION | 1
  exportedAt: string
  progress: string | null
  place: string | null
  uiPrefs: string | null
  wordMemory: string | null
  dailyRun: string | null
  endingsLab: string | null
  questTrack: string | null
}

function readKey(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeKey(key: string, value: string | null) {
  if (typeof window === "undefined") return
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* quota / private mode */
  }
}

export function buildGreekBackupPayload(): GreekBackupPayloadV1 {
  const k = GREEK_BACKUP_STORAGE_KEYS
  return {
    version: GREEK_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    progress: readKey(k.progress),
    place: readKey(k.place),
    uiPrefs: readKey(k.uiPrefs),
    wordMemory: readKey(k.wordMemory),
    dailyRun: readKey(k.dailyRun),
    endingsLab: readKey(k.endingsLab),
    questTrack: readKey(k.questTrack),
  }
}

export function parseGreekBackupPayload(raw: unknown): GreekBackupPayloadV1 | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const v = o.version
  if (v !== 1 && v !== GREEK_BACKUP_VERSION) return null
  if (typeof o.exportedAt !== "string") return null
  const opt = (key: string): string | null => {
    const val = o[key]
    if (val === null || val === undefined) return null
    if (typeof val === "string") return val
    return null
  }
  return {
    version: v === 1 ? 1 : GREEK_BACKUP_VERSION,
    exportedAt: o.exportedAt,
    progress: opt("progress"),
    place: opt("place"),
    uiPrefs: opt("uiPrefs"),
    wordMemory: opt("wordMemory"),
    dailyRun: opt("dailyRun"),
    endingsLab: opt("endingsLab"),
    questTrack: v === 1 ? null : opt("questTrack"),
  }
}

/** Applies a validated backup; overwrites existing keys. */
export function applyGreekBackupPayload(payload: GreekBackupPayloadV1): void {
  const k = GREEK_BACKUP_STORAGE_KEYS
  writeKey(k.progress, payload.progress)
  writeKey(k.place, payload.place)
  writeKey(k.uiPrefs, payload.uiPrefs)
  writeKey(k.wordMemory, payload.wordMemory)
  writeKey(k.dailyRun, payload.dailyRun)
  writeKey(k.endingsLab, payload.endingsLab)
  writeKey(k.questTrack, payload.questTrack)
}

export function clearAllGreekStudyStorage(): void {
  const k = GREEK_BACKUP_STORAGE_KEYS
  writeKey(k.progress, null)
  writeKey(k.place, null)
  writeKey(k.uiPrefs, null)
  writeKey(k.wordMemory, null)
  writeKey(k.dailyRun, null)
  writeKey(k.endingsLab, null)
  writeKey(k.questTrack, null)
}

export function downloadGreekBackupJson() {
  const payload = buildGreekBackupPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `fx-greek-study-backup-v${GREEK_BACKUP_VERSION}.json`
  a.click()
  URL.revokeObjectURL(url)
}
