import { MORPH_PILOT_CHAPTERS } from "@/lib/bible/morph-pilot-menu"
import type { GreekStudyProgress } from "@/lib/devotions-greek-progress"

const QUEST_COMPLETE_SUFFIX = "-quest-complete"

/** YYYY-M-D normalized like devotions-greek-progress `todayStr`. */
export function dateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Total verses in the morph pilot catalog (sum of per-chapter verse counts). */
export function pilotVerseTotalCount(): number {
  return MORPH_PILOT_CHAPTERS.reduce((sum, ch) => sum + ch.maxVerse, 0)
}

/**
 * Unique pilot verses for which the user completed Verse Quest at least once
 * (deduped across all dates). Keys are `bookSlug-chapter-verse`.
 */
export function uniqueQuestCompletedVerseLevelKeys(progress: GreekStudyProgress): Set<string> {
  const out = new Set<string>()
  for (const keys of Object.values(progress.verseKeysByDate)) {
    for (const k of keys) {
      if (k.endsWith(QUEST_COMPLETE_SUFFIX)) {
        out.add(k.slice(0, -QUEST_COMPLETE_SUFFIX.length))
      }
    }
  }
  return out
}

export function uniqueQuestCompletedVersesCount(progress: GreekStudyProgress): number {
  return uniqueQuestCompletedVerseLevelKeys(progress).size
}

/**
 * Sum of daily XP over the last `days` calendar days ending on `now` (inclusive).
 */
export function rollingDailyXpSum(progress: GreekStudyProgress, days = 7, now: Date = new Date()): number {
  let sum = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = dateKeyFromDate(d)
    sum += progress.dailyXpByDate[key] ?? 0
  }
  return sum
}

/**
 * How many entries in `daysActive` fall within the rolling `days`-day window ending today.
 */
export function activeDaysInRollingWindow(
  progress: GreekStudyProgress,
  days = 7,
  now: Date = new Date(),
): number {
  const windowKeys = new Set<string>()
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    windowKeys.add(dateKeyFromDate(d))
  }
  return progress.daysActive.filter((d) => windowKeys.has(d)).length
}
