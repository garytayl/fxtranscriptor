import type { PassageReference } from "@/lib/bible/reference"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"
import { NT_MORPH_CHAPTER_DATA } from "@/lib/bible/morph-data/nt-datasets.generated"

type MorphChapterFile = {
  meta: {
    source: string
    cite: string
    parsingLicense: string
    textLicenseNote: string
  }
  bookSlug: string
  chapter: number
  verses: Record<string, GreekMorphToken[]>
}

const MORPH_PILOT_CHAPTERS = NT_MORPH_CHAPTER_DATA as unknown as MorphChapterFile[]

const MORPH_META = MORPH_PILOT_CHAPTERS[0].meta

/**
 * API.Bible book `id` is often USFM (e.g. LUK, JHN). Local HCSB uses the same ids as `lib/bible/constants`.
 */
const USFM_ID_TO_MORPH_SLUG: Record<string, string> = {
  MAT: "matthew",
  MRK: "mark",
  LUK: "luke",
  JHN: "john",
  ACT: "acts",
  ROM: "romans",
  "1CO": "1-corinthians",
  "2CO": "2-corinthians",
  GAL: "galatians",
  EPH: "ephesians",
  PHP: "philippians",
  COL: "colossians",
  "1TH": "1-thessalonians",
  "2TH": "2-thessalonians",
  "1TI": "1-timothy",
  "2TI": "2-timothy",
  TIT: "titus",
  PHM: "philemon",
  HEB: "hebrews",
  JAS: "james",
  "1PE": "1-peter",
  "2PE": "2-peter",
  "1JN": "1-john",
  "2JN": "2-john",
  "3JN": "3-john",
  JUD: "jude",
  REV: "revelation",
}

/**
 * Some translations expose longer book names; slugify yields paths like `the-gospel-of-luke` while
 * morph JSON uses `luke`.
 */
const MORPH_BOOK_SLUG_ALIASES: Record<string, string> = {
  "the-gospel-of-luke": "luke",
  "the-gospel-according-to-luke": "luke",
  "gospel-of-luke": "luke",
  "the-gospel-of-john": "john",
  "the-gospel-according-to-john": "john",
  "gospel-of-john": "john",
}

/** Map URL/API slug + optional USFM id to the `bookSlug` stored in morph JSON. */
export function resolveMorphDatasetBookSlug(bookSlug: string, bookId?: string | null): string {
  if (bookId) {
    const fromUsfm = USFM_ID_TO_MORPH_SLUG[bookId.trim().toUpperCase()]
    if (fromUsfm) return fromUsfm
  }
  const key = bookSlug.trim().toLowerCase()
  return MORPH_BOOK_SLUG_ALIASES[key] ?? bookSlug
}

function getPilotChapter(
  bookSlug: string,
  chapter: number,
  bookId?: string | null
): MorphChapterFile | null {
  const resolved = resolveMorphDatasetBookSlug(bookSlug, bookId)
  return (
    MORPH_PILOT_CHAPTERS.find((p) => p.bookSlug === resolved && p.chapter === chapter) ?? null
  )
}

export function getGreekMorphTokensForChapter(
  bookSlug: string,
  chapter: number,
  bookId?: string | null
): Record<number, GreekMorphToken[]> | null {
  const pilot = getPilotChapter(bookSlug, chapter, bookId)
  if (!pilot) return null
  const out: Record<number, GreekMorphToken[]> = {}
  for (const [v, tokens] of Object.entries(pilot.verses)) {
    out[Number(v)] = tokens
  }
  return out
}

export function getGreekMorphToken(
  bookSlug: string,
  chapter: number,
  verse: number,
  wordIndex: number,
  bookId?: string | null
): GreekMorphToken | null {
  const ch = getGreekMorphTokensForChapter(bookSlug, chapter, bookId)
  const tokens = ch?.[verse]
  if (!tokens || wordIndex < 0 || wordIndex >= tokens.length) return null
  return tokens[wordIndex] ?? null
}

export type MorphPassagePayload = {
  available: boolean
  cite: string
  parsingLicense: string
  textLicenseNote: string
  verses: { number: number; tokens: GreekMorphToken[] }[]
  readerGrammarUrl: string | null
}

/** Reader URL with `t=fx-greek` + verse anchor for Greek grammar pilot chapters. */
export function getReaderGrammarUrl(bookSlug: string, chapter: number, verse: number): string {
  const params = new URLSearchParams()
  params.set("t", FX_GREEK_GRAMMAR_TRANSLATION_KEY)
  params.set("v", String(verse))
  return `/bible/${bookSlug}/${chapter}?${params.toString()}`
}

function isMorphPilotChapter(bookSlug: string, chapterNumber: number, bookId?: string | null): boolean {
  return getPilotChapter(bookSlug, chapterNumber, bookId) != null
}

/**
 * Returns morph tokens for a parsed passage when the pilot dataset covers that chapter.
 */
export function getMorphologyForPassage(parsed: PassageReference): MorphPassagePayload {
  const { bookSlug, chapterNumber, verseRange } = parsed
  const ch = getGreekMorphTokensForChapter(bookSlug, chapterNumber, null)
  if (!ch || !verseRange) {
    return {
      available: false,
      cite: MORPH_META.cite,
      parsingLicense: MORPH_META.parsingLicense,
      textLicenseNote: MORPH_META.textLicenseNote,
      verses: [],
      readerGrammarUrl: null,
    }
  }

  const verses: { number: number; tokens: GreekMorphToken[] }[] = []
  for (let v = verseRange.start; v <= verseRange.end; v++) {
    const tokens = ch[v]
    if (tokens?.length) {
      verses.push({ number: v, tokens })
    }
  }

  const firstVerse = verseRange.start
  const available = verses.length > 0 && isMorphPilotChapter(bookSlug, chapterNumber, null)

  return {
    available,
    cite: MORPH_META.cite,
    parsingLicense: MORPH_META.parsingLicense,
    textLicenseNote: MORPH_META.textLicenseNote,
    verses,
    readerGrammarUrl: available ? getReaderGrammarUrl(bookSlug, chapterNumber, firstVerse) : null,
  }
}
