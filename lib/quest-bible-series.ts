/**
 * Multi-day Bible reading "series" for Verse Quest: ordered verses with calendar pace hints and catch-up.
 */

import type { MorphPilotChapterMenuItem } from "@/lib/bible/morph-pilot-menu"
import { MORPH_PILOT_CHAPTERS } from "@/lib/bible/morph-pilot-menu"

export const BIBLE_QUEST_TRACK_STORAGE_KEY = "fx_devotions_greek_v1_quest_track"

export type QuestReadingMode = "calendar" | "series"

export type BibleSeriesId =
  | "full_nt"
  | "gospels"
  | "acts"
  | "pauline"
  | "general_epistles"
  | "revelation"

export type BibleSeriesMeta = {
  id: BibleSeriesId
  label: string
  short: string
}

export const BIBLE_READING_SERIES: BibleSeriesMeta[] = [
  { id: "full_nt", label: "Full New Testament (pilot)", short: "Full NT" },
  { id: "gospels", label: "Gospels", short: "Gospels" },
  { id: "acts", label: "Acts", short: "Acts" },
  { id: "pauline", label: "Pauline letters", short: "Paul" },
  { id: "general_epistles", label: "General epistles", short: "General" },
  { id: "revelation", label: "Revelation", short: "Revelation" },
]

const GOSPELS = new Set(["matthew", "mark", "luke", "john"])
const PAULINE = new Set([
  "romans",
  "1-corinthians",
  "2-corinthians",
  "galatians",
  "ephesians",
  "philippians",
  "colossians",
  "1-thessalonians",
  "2-thessalonians",
  "1-timothy",
  "2-timothy",
  "titus",
  "philemon",
])
const GENERAL_EPISTLES = new Set([
  "hebrews",
  "james",
  "1-peter",
  "2-peter",
  "1-john",
  "2-john",
  "3-john",
  "jude",
])

export type QuestTrackState =
  | { mode: "calendar" }
  | {
      mode: "series"
      seriesId: BibleSeriesId
      startDateKey: string
      /** Next verse to complete (0-based index into `buildSeriesPlan`). When >= plan length, the series is finished. */
      nextStepIndex: number
    }

export type BibleQuestVerseTarget = {
  pilotIdx: number
  verse: number
  levelKey: string
  label: string
}

function dayNumberFromDateKey(dateKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return Math.floor(Date.now() / 86400000)
  const y = Number.parseInt(match[1], 10)
  const m = Number.parseInt(match[2], 10)
  const d = Number.parseInt(match[3], 10)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return Math.floor(Date.now() / 86400000)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** Inclusive day count from start through end (same day => 1). */
export function inclusiveDaySpan(startDateKey: string, endDateKey: string): number {
  const a = dayNumberFromDateKey(startDateKey)
  const b = dayNumberFromDateKey(endDateKey)
  return Math.max(1, b - a + 1)
}

function chapterKey(ch: MorphPilotChapterMenuItem): string {
  return `${ch.bookSlug}:${ch.chapter}`
}

function pilotIndexLookup(): Map<string, number> {
  const m = new Map<string, number>()
  MORPH_PILOT_CHAPTERS.forEach((ch, i) => {
    m.set(chapterKey(ch), i)
  })
  return m
}

const PILOT_BY_CHAPTER = pilotIndexLookup()

function filterChaptersForSeries(seriesId: BibleSeriesId): MorphPilotChapterMenuItem[] {
  const all = MORPH_PILOT_CHAPTERS
  switch (seriesId) {
    case "full_nt":
      return all
    case "gospels":
      return all.filter((c) => GOSPELS.has(c.bookSlug))
    case "acts":
      return all.filter((c) => c.bookSlug === "acts")
    case "pauline":
      return all.filter((c) => PAULINE.has(c.bookSlug))
    case "general_epistles":
      return all.filter((c) => GENERAL_EPISTLES.has(c.bookSlug))
    case "revelation":
      return all.filter((c) => c.bookSlug === "revelation")
    default:
      return all
  }
}

/** Flatten pilot chapters into one verse per step (canonical pilot order). */
export function buildSeriesPlan(seriesId: BibleSeriesId): BibleQuestVerseTarget[] {
  const chapters = filterChaptersForSeries(seriesId)
  const steps: BibleQuestVerseTarget[] = []
  for (const ch of chapters) {
    const pilotIdx = PILOT_BY_CHAPTER.get(chapterKey(ch))
    if (pilotIdx == null) continue
    const max = Math.max(1, ch.maxVerse)
    for (let verse = 1; verse <= max; verse++) {
      steps.push({
        pilotIdx,
        verse,
        levelKey: `${ch.bookSlug}-${ch.chapter}-${verse}`,
        label: ch.label,
      })
    }
  }
  return steps
}

export function seriesPlanTotalVerses(seriesId: BibleSeriesId): number {
  return buildSeriesPlan(seriesId).length
}

export function assignmentForSeriesStep(
  plan: BibleQuestVerseTarget[],
  stepIndex: number,
): BibleQuestVerseTarget | null {
  if (stepIndex < 0 || stepIndex >= plan.length) return null
  return plan[stepIndex]
}

/**
 * 0-based index of the verse "expected" from a one-verse-per-day schedule (day 1 = index 0).
 * Clamped to the last verse if the calendar has outrun the plan.
 */
export function expectedSeriesStepIndex0(
  startDateKey: string,
  todayDateKey: string,
  planLength: number,
): number | null {
  if (planLength <= 0) return null
  const span = inclusiveDaySpan(startDateKey, todayDateKey)
  return Math.min(planLength - 1, span - 1)
}

/** Positive = behind schedule (need to catch up), negative = ahead. */
export function seriesPaceDeltaVerses(
  nextStepIndex: number,
  startDateKey: string,
  todayDateKey: string,
  planLength: number,
): number | null {
  const expected = expectedSeriesStepIndex0(startDateKey, todayDateKey, planLength)
  if (expected == null) return null
  return expected - nextStepIndex
}

export function describeSeriesPace(delta: number | null): string {
  if (delta == null) return ""
  if (delta === 0) return "On pace (one verse per day)."
  if (delta > 0) return `${delta} verse${delta === 1 ? "" : "s"} behind — keep going; catch up when you can.`
  const a = -delta
  return `${a} verse${a === 1 ? "" : "s"} ahead of the one-a-day line.`
}

export function defaultQuestTrack(): QuestTrackState {
  return { mode: "calendar" }
}

export function parseQuestTrack(raw: string | null): QuestTrackState {
  if (!raw) return defaultQuestTrack()
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    if (o.mode === "series") {
      const seriesId = o.seriesId as BibleSeriesId
      const startDateKey = o.startDateKey
      const nextStepIndex = o.nextStepIndex
      const validId = BIBLE_READING_SERIES.some((s) => s.id === seriesId)
      if (
        validId &&
        typeof startDateKey === "string" &&
        /^(\d{4})-(\d{2})-(\d{2})$/.test(startDateKey) &&
        typeof nextStepIndex === "number" &&
        Number.isFinite(nextStepIndex) &&
        nextStepIndex >= 0
      ) {
        return {
          mode: "series",
          seriesId,
          startDateKey,
          nextStepIndex: Math.floor(nextStepIndex),
        }
      }
    }
    return defaultQuestTrack()
  } catch {
    return defaultQuestTrack()
  }
}

export function loadQuestTrack(): QuestTrackState {
  if (typeof window === "undefined") return defaultQuestTrack()
  return parseQuestTrack(window.localStorage.getItem(BIBLE_QUEST_TRACK_STORAGE_KEY))
}

export function saveQuestTrack(state: QuestTrackState): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(BIBLE_QUEST_TRACK_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
}

/** Identity for initial placement only (not step progress). */
export function questTrackPlacementKey(track: QuestTrackState): string {
  if (track.mode === "calendar") return "calendar"
  return `series:${track.seriesId}:${track.startDateKey}`
}
