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

/** Map common book name variants to canonical names used by scripture APIs (e.g. "Psalms" not "Psalm") */
const BOOK_NAME_ALIASES: Record<string, string> = {
  Psalm: "Psalms",
  psalm: "Psalms",
}

/**
 * Bible book abbreviations and common misspellings (lowercase) → canonical API name.
 * Enables lazy search like "Jn 3:16", "Gen 1", "Rom 8" and typos like "jhn", "genisis".
 */
const BOOK_ABBREVIATIONS: Record<string, string> = {
  // Old Testament
  gen: "Genesis",
  genesis: "Genesis",
  genisis: "Genesis",
  ex: "Exodus",
  exod: "Exodus",
  exodus: "Exodus",
  lev: "Leviticus",
  leviticus: "Leviticus",
  num: "Numbers",
  numbers: "Numbers",
  deut: "Deuteronomy",
  deuteronomy: "Deuteronomy",
  josh: "Joshua",
  joshua: "Joshua",
  jdg: "Judges",
  judg: "Judges",
  judges: "Judges",
  ruth: "Ruth",
  "1sam": "1 Samuel",
  "1 samuel": "1 Samuel",
  "2sam": "2 Samuel",
  "2 samuel": "2 Samuel",
  "1sa": "1 Samuel",
  "2sa": "2 Samuel",
  "1kgs": "1 Kings",
  "1 kings": "1 Kings",
  "2kgs": "2 Kings",
  "2 kings": "2 Kings",
  "1ki": "1 Kings",
  "2ki": "2 Kings",
  "1chron": "1 Chronicles",
  "1 chronicles": "1 Chronicles",
  "2chron": "2 Chronicles",
  "2 chronicles": "2 Chronicles",
  "1ch": "1 Chronicles",
  "2ch": "2 Chronicles",
  ezra: "Ezra",
  neh: "Nehemiah",
  nehemiah: "Nehemiah",
  est: "Esther",
  esther: "Esther",
  job: "Job",
  ps: "Psalms",
  psa: "Psalms",
  psalms: "Psalms",
  psalm: "Psalms",
  prov: "Proverbs",
  proverbs: "Proverbs",
  eccl: "Ecclesiastes",
  ecclesiastes: "Ecclesiastes",
  song: "Song of Solomon",
  sng: "Song of Solomon",
  "song of songs": "Song of Solomon",
  "song of solomon": "Song of Solomon",
  isa: "Isaiah",
  isaiah: "Isaiah",
  jer: "Jeremiah",
  jeremiah: "Jeremiah",
  lam: "Lamentations",
  lamentations: "Lamentations",
  ezek: "Ezekiel",
  ezekiel: "Ezekiel",
  ezk: "Ezekiel",
  dan: "Daniel",
  daniel: "Daniel",
  hos: "Hosea",
  hosea: "Hosea",
  joel: "Joel",
  jol: "Joel",
  amos: "Amos",
  amo: "Amos",
  obad: "Obadiah",
  obadiah: "Obadiah",
  oba: "Obadiah",
  jon: "Jonah",
  jonah: "Jonah",
  mic: "Micah",
  micah: "Micah",
  nah: "Nahum",
  nahum: "Nahum",
  nam: "Nahum",
  hab: "Habakkuk",
  habakkuk: "Habakkuk",
  zeph: "Zephaniah",
  zephaniah: "Zephaniah",
  zep: "Zephaniah",
  hag: "Haggai",
  haggai: "Haggai",
  zech: "Zechariah",
  zechariah: "Zechariah",
  zec: "Zechariah",
  mal: "Malachi",
  malachi: "Malachi",
  // New Testament
  matt: "Matthew",
  mat: "Matthew",
  matthew: "Matthew",
  mrk: "Mark",
  mark: "Mark",
  luke: "Luke",
  luk: "Luke",
  jn: "John",
  jhn: "John",
  john: "John",
  act: "Acts",
  acts: "Acts",
  rom: "Romans",
  romans: "Romans",
  "1cor": "1 Corinthians",
  "1 corinthians": "1 Corinthians",
  "1co": "1 Corinthians",
  "2cor": "2 Corinthians",
  "2 corinthians": "2 Corinthians",
  "2co": "2 Corinthians",
  gal: "Galatians",
  galatians: "Galatians",
  eph: "Ephesians",
  ephesians: "Ephesians",
  phil: "Philippians",
  philippians: "Philippians",
  php: "Philippians",
  col: "Colossians",
  colossians: "Colossians",
  "1thess": "1 Thessalonians",
  "1 thessalonians": "1 Thessalonians",
  "1th": "1 Thessalonians",
  "2thess": "2 Thessalonians",
  "2 thessalonians": "2 Thessalonians",
  "2th": "2 Thessalonians",
  "1tim": "1 Timothy",
  "1 timothy": "1 Timothy",
  "1ti": "1 Timothy",
  "2tim": "2 Timothy",
  "2 timothy": "2 Timothy",
  "2ti": "2 Timothy",
  tit: "Titus",
  titus: "Titus",
  philem: "Philemon",
  philemon: "Philemon",
  phlm: "Philemon",
  heb: "Hebrews",
  hebrews: "Hebrews",
  jas: "James",
  james: "James",
  "1pet": "1 Peter",
  "1 peter": "1 Peter",
  "1pe": "1 Peter",
  "2pet": "2 Peter",
  "2 peter": "2 Peter",
  "2pe": "2 Peter",
  "1jn": "1 John",
  "1 john": "1 John",
  "2jn": "2 John",
  "2 john": "2 John",
  "3jn": "3 John",
  "3 john": "3 John",
  jud: "Jude",
  jude: "Jude",
  rev: "Revelation",
  revelation: "Revelation",
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

  const byExact = BOOK_NAME_ALIASES[trimmed]
  if (byExact) return byExact

  const key = trimmed.toLowerCase().replace(/\s+/g, " ")
  const byAbbrev = BOOK_ABBREVIATIONS[key]
  if (byAbbrev) return byAbbrev

  // "1 cor" → "1 cor" (no space collapse needed for "1 corinthians")
  const keyNoSpace = key.replace(/\s/g, "")
  const byAbbrevNoSpace = BOOK_ABBREVIATIONS[keyNoSpace]
  if (byAbbrevNoSpace) return byAbbrevNoSpace

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
  const normalized = raw.trim().replace(/\s*:\s*/g, ":")
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
  const segments = raw
    .split(/[\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  const expanded: string[] = []

  for (const segment of segments) {
    const parts = segment.split(",").map((entry) => entry.trim()).filter(Boolean)
    if (parts.length === 0) {
      continue
    }

    const first = parsePassageReference(parts[0])
    if (!first) {
      expanded.push(segment)
      continue
    }

    expanded.push(parts[0])

    for (const part of parts.slice(1)) {
      if (!part) continue
      const hasBookAndChapter = /[a-zA-Z]+\s+\d+/.test(part)
      if (hasBookAndChapter) {
        expanded.push(part)
        continue
      }
      expanded.push(`${first.book} ${first.chapterNumber}:${part}`)
    }
  }

  return expanded
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
