/**
 * Curated passages for "passage of the day" — OT, NT, Psalms, Wisdom.
 * One per day by day-of-year; cycles so every day has a fixed passage.
 */

const PASSAGES: string[] = [
  "Genesis 1:1-5",
  "Psalm 1",
  "Matthew 5:1-12",
  "John 1:1-14",
  "Romans 8:28-39",
  "Isaiah 40:28-31",
  "Psalm 23",
  "Matthew 6:9-13",
  "John 3:16-21",
  "Philippians 4:4-9",
  "Psalm 27:1-6",
  "Proverbs 3:1-8",
  "Matthew 11:28-30",
  "John 14:1-7",
  "Romans 12:1-2",
  "Psalm 34:1-8",
  "Isaiah 53:4-6",
  "Matthew 28:18-20",
  "John 15:1-11",
  "Galatians 5:22-26",
  "Psalm 42:1-5",
  "Lamentations 3:22-26",
  "Luke 15:11-24",
  "John 17:20-26",
  "Ephesians 2:8-10",
  "Psalm 46:1-5",
  "Isaiah 55:6-9",
  "Matthew 22:36-40",
  "Acts 4:12",
  "Colossians 3:12-17",
  "Psalm 51:10-12",
  "Micah 6:6-8",
  "Matthew 25:34-40",
  "Romans 5:1-5",
  "Hebrews 11:1-3",
  "Psalm 63:1-5",
  "Isaiah 61:1-3",
  "Luke 6:27-36",
  "Romans 8:1-4",
  "James 1:2-5",
  "Psalm 91:1-6",
  "Psalm 103:1-5",
  "Matthew 6:25-34",
  "John 8:31-36",
  "1 Corinthians 13:4-8",
  "Psalm 119:105-112",
  "Isaiah 43:1-4",
  "Mark 1:35-39",
  "John 10:27-30",
  "2 Corinthians 4:16-18",
  "Psalm 121",
  "Psalm 139:1-6",
  "Matthew 7:7-11",
  "Luke 18:9-14",
  "Romans 12:9-13",
  "Psalm 145:8-13",
  "Proverbs 16:3",
  "Matthew 5:14-16",
  "John 13:34-35",
  "1 John 4:7-12",
  "Psalm 19:1-6",
  "Isaiah 26:3-4",
  "Matthew 6:1-6",
  "Luke 10:38-42",
  "1 Peter 5:6-7",
  "Psalm 27:14",
  "Joshua 1:8-9",
  "Matthew 16:24-26",
  "John 16:33",
  "Revelation 21:3-5",
  "Psalm 34:18-19",
  "Isaiah 41:10",
  "Matthew 18:19-20",
  "Acts 2:38-39",
  "Hebrews 12:1-2",
  "Psalm 46:10",
  "Psalm 90:12-17",
  "Matthew 28:1-10",
  "Romans 6:3-5",
  "1 John 1:8-9",
  "Psalm 118:24",
  "Psalm 136:1-9",
  "Isaiah 9:2-7",
  "Luke 2:8-14",
  "2 Corinthians 5:17",
  "Psalm 150",
]

export const DEVOTIONS_PASSAGES_COUNT = PASSAGES.length

/** Day of year 1–366. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneDay = 864e5
  return Math.floor(diff / oneDay)
}

/** Passage reference for a given date. Same date always returns the same passage. */
export function getPassageRefForDate(date: Date): string {
  const day = dayOfYear(date)
  const index = (day - 1) % PASSAGES.length
  return PASSAGES[index] ?? PASSAGES[0]
}

/** All passages (for picker if we add one). */
export function getAllPassageRefs(): string[] {
  return [...PASSAGES]
}
