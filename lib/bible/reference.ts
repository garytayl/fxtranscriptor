export type VerseRange = {
  start: number
  end: number
}

export type PassageReference = {
  raw: string
  book: string
  bookSlug: string
  chapterNumber: number
  verseRange: VerseRange | null
}

const ordinalReplacements: Record<string, string> = {
  First: "1",
  Second: "2",
  Third: "3",
  "1st": "1",
  "2nd": "2",
  "3rd": "3",
  I: "1",
  II: "2",
  III: "3",
}

export function normalizeBookName(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    return trimmed
  }

  for (const [prefix, replacement] of Object.entries(ordinalReplacements)) {
    if (trimmed.startsWith(`${prefix} `)) {
      return `${replacement} ${trimmed.slice(prefix.length).trim()}`
    }
  }

  return trimmed
}

export function slugifyBookName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function parseVerseRange(raw?: string | null): VerseRange | null {
  if (!raw) {
    return null
  }

  const normalized = raw.trim()
  if (!normalized) {
    return null
  }

  const match = normalized.match(/^(\d+)(?:-(\d+))?$/)
  if (!match) {
    return null
  }

  const start = Number.parseInt(match[1], 10)
  const end = Number.parseInt(match[2] ?? match[1], 10)

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null
  }
  if (start <= 0 || end <= 0 || end < start) {
    return null
  }

  return { start, end }
}

export function parsePassageReference(raw: string): PassageReference | null {
  const normalized = raw.trim()
  if (!normalized) {
    return null
  }

  const match = normalized.match(/^(.+?)\s+(\d+)(?::(\d+(?:-\d+)?))?$/)
  if (!match) {
    return null
  }

  const bookRaw = normalizeBookName(match[1])
  const chapterNumber = Number.parseInt(match[2], 10)
  if (!Number.isFinite(chapterNumber)) {
    return null
  }

  const verseRange = parseVerseRange(match[3] ?? null)
  const bookSlug = slugifyBookName(bookRaw)

  return {
    raw: normalized,
    book: bookRaw,
    bookSlug,
    chapterNumber,
    verseRange,
  }
}

export function parsePassageList(raw: string): PassageReference[] {
  return raw
    .split(/[\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parsePassageReference(entry))
    .filter((entry): entry is PassageReference => Boolean(entry))
}

export function isVerseInRange(verseNumber: number, range: VerseRange | null): boolean {
  if (!range) {
    return false
  }
  return verseNumber >= range.start && verseNumber <= range.end
}

export function getReaderUrlFromReference(raw: string, translationKey?: string | null): string | null {
  const parsed = parsePassageReference(raw)
  if (!parsed) {
    return null
  }
  const params = new URLSearchParams()
  if (parsed.verseRange) {
    const range =
      parsed.verseRange.start === parsed.verseRange.end
        ? String(parsed.verseRange.start)
        : `${parsed.verseRange.start}-${parsed.verseRange.end}`
    params.set("v", range)
  }
  if (translationKey) {
    params.set("t", translationKey)
  }
  const query = params.toString()
  return `/bible/${parsed.bookSlug}/${parsed.chapterNumber}${query ? `?${query}` : ""}`
}

export function getReaderUrlFromVerse(
  verse: { book: string; chapter: number; verse_start: number; verse_end: number | null },
  translationKey?: string | null
): string {
  const bookSlug = slugifyBookName(normalizeBookName(verse.book))
  const params = new URLSearchParams()
  const range =
    verse.verse_end && verse.verse_end !== verse.verse_start
      ? `${verse.verse_start}-${verse.verse_end}`
      : String(verse.verse_start)
  params.set("v", range)
  if (translationKey) {
    params.set("t", translationKey)
  }
  return `/bible/${bookSlug}/${verse.chapter}?${params.toString()}`
}
