/**
 * Curated meditation series: ordered passage refs for full-screen meditation flow.
 * Daily uses lib/devotions-passages (same as main devotions “today”).
 */

import { getPassageRefForDate } from "@/lib/devotions-passages"

export const DAILY_SERIES_ID = "daily"

export type MeditationSeries = {
  id: string
  title: string
  description: string
  /** UI grouping, e.g. "Psalms" */
  group?: string
  passages: string[]
}

const SERIES: MeditationSeries[] = [
  {
    id: DAILY_SERIES_ID,
    title: "Today’s meditation",
    description: "Same rotating daily passage as the main devotions screen — one sitting, fresh each calendar day.",
    passages: [],
  },
  {
    id: "romans",
    group: "Epistles",
    title: "Romans",
    description: "Key movements through Paul’s letter: gospel, grace, new life, and God’s faithfulness.",
    passages: [
      "Romans 1:16-17",
      "Romans 3:21-26",
      "Romans 5:1-11",
      "Romans 6:1-14",
      "Romans 8:1-17",
      "Romans 8:31-39",
      "Romans 12:1-8",
      "Romans 15:13",
    ],
  },
  {
    id: "philippians",
    group: "Epistles",
    title: "Philippians",
    description: "Joy, humility, and Christ-shaped mind — short epistle, rich for slow meditation.",
    passages: [
      "Philippians 1:3-11",
      "Philippians 1:27-30",
      "Philippians 2:1-11",
      "Philippians 2:12-18",
      "Philippians 3:7-14",
      "Philippians 4:4-9",
      "Philippians 4:10-13",
    ],
  },
  {
    id: "psalms-lament",
    group: "Psalms",
    title: "Psalms of lament",
    description: "Honest prayer when God feels distant — complaint that still turns toward him.",
    passages: [
      "Psalm 13",
      "Psalm 22:1-11",
      "Psalm 42:1-11",
      "Psalm 43",
      "Psalm 51:1-17",
      "Psalm 88:1-12",
    ],
  },
  {
    id: "psalms-praise",
    group: "Psalms",
    title: "Psalms of praise",
    description: "Creation, kingship, and thanks — voices lifted to the Lord.",
    passages: [
      "Psalm 8",
      "Psalm 19:1-14",
      "Psalm 24",
      "Psalm 47",
      "Psalm 100",
      "Psalm 145:1-13",
      "Psalm 150",
    ],
  },
  {
    id: "psalms-trust",
    group: "Psalms",
    title: "Psalms of trust",
    description: "Resting in God as refuge, shepherd, and light.",
    passages: [
      "Psalm 23",
      "Psalm 27:1-6",
      "Psalm 46:1-11",
      "Psalm 62:1-12",
      "Psalm 91:1-16",
      "Psalm 121",
    ],
  },
]

const BY_ID = new Map(SERIES.map((s) => [s.id, s]))

export function listMeditationSeries(): MeditationSeries[] {
  return [...SERIES]
}

export function getMeditationSeries(id: string): MeditationSeries | undefined {
  return BY_ID.get(id)
}

export function isDailySeriesId(id: string): boolean {
  return id === DAILY_SERIES_ID
}

/**
 * Which passage ref to load for this series and stored cursor (next passage index).
 * Daily ignores cursor and uses calendar passage.
 */
export function passageRefForSeries(seriesId: string, passageIndex: number): string {
  if (isDailySeriesId(seriesId)) {
    return getPassageRefForDate(new Date())
  }
  const s = BY_ID.get(seriesId)
  if (!s || s.passages.length === 0) {
    return getPassageRefForDate(new Date())
  }
  const i = ((passageIndex % s.passages.length) + s.passages.length) % s.passages.length
  return s.passages[i] ?? s.passages[0]
}

export function passageCountForSeries(seriesId: string): number {
  if (isDailySeriesId(seriesId)) return 0
  return BY_ID.get(seriesId)?.passages.length ?? 0
}
