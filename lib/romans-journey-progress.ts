/**
 * Local-only Romans Journey progress: step position, daily pace, one-time XP flags.
 */

import { ROMANS_JOURNEY_TOTAL } from "@/lib/romans-journey-data"

const STORAGE_KEY = "fx_romans_journey_v1"

export type RomansJourneyMode = "free" | "daily"

type Stored = {
  v: 1
  /** Screen to show on resume (0–24), or 25 = finished */
  currentStepIndex: number
  mode: RomansJourneyMode
  /** First-time XP per step (aligned with steps) */
  xpGranted: boolean[]
  /** Last calendar day (YYYY-MM-DD) user advanced to the *next* step (daily mode) */
  lastAdvanceDate: string | null
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function defaultStored(): Stored {
  return {
    v: 1,
    currentStepIndex: 0,
    mode: "free",
    xpGranted: Array.from({ length: ROMANS_JOURNEY_TOTAL }, () => false),
    lastAdvanceDate: null,
  }
}

function read(): Stored {
  if (typeof window === "undefined") return defaultStored()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStored()
    const p = JSON.parse(raw) as Partial<Stored>
    const xp = Array.isArray(p.xpGranted)
      ? p.xpGranted.map((x) => x === true).slice(0, ROMANS_JOURNEY_TOTAL)
      : []
    while (xp.length < ROMANS_JOURNEY_TOTAL) xp.push(false)
    return {
      v: 1,
      currentStepIndex:
        typeof p.currentStepIndex === "number" && p.currentStepIndex >= 0 && p.currentStepIndex <= ROMANS_JOURNEY_TOTAL
          ? Math.floor(p.currentStepIndex)
          : 0,
      mode: p.mode === "daily" ? "daily" : "free",
      xpGranted: xp,
      lastAdvanceDate: typeof p.lastAdvanceDate === "string" ? p.lastAdvanceDate : null,
    }
  } catch {
    return defaultStored()
  }
}

function write(s: Stored): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function getRomansJourneyProgress(): Stored {
  return read()
}

export function setRomansJourneyMode(mode: RomansJourneyMode): void {
  const s = read()
  s.mode = mode
  write(s)
}

export function setRomansJourneyStep(index: number): void {
  const s = read()
  s.currentStepIndex = Math.max(0, Math.min(ROMANS_JOURNEY_TOTAL, Math.floor(index)))
  write(s)
}

/** Daily mode: at most one forward Continue per calendar day (including 24 → finished). */
export function canAdvanceRomansStep(mode: RomansJourneyMode): boolean {
  if (mode === "free") return true
  const s = read()
  return s.lastAdvanceDate !== todayStr()
}

/** After advancing from step `completedStep` to `completedStep + 1` (or to finished when completedStep is 24). */
export function recordRomansJourneyAdvance(completedStep: number, mode: RomansJourneyMode): void {
  const s = read()
  s.currentStepIndex = Math.min(ROMANS_JOURNEY_TOTAL, completedStep + 1)
  if (mode === "daily") {
    s.lastAdvanceDate = todayStr()
  }
  write(s)
}

export function markRomansJourneyXpGranted(stepIndex: number): void {
  const s = read()
  if (stepIndex < 0 || stepIndex >= ROMANS_JOURNEY_TOTAL) return
  const next = [...s.xpGranted]
  next[stepIndex] = true
  s.xpGranted = next
  write(s)
}

export function hasRomansJourneyXpGranted(stepIndex: number): boolean {
  return read().xpGranted[stepIndex] === true
}

export function resetRomansJourney(): void {
  write(defaultStored())
}
