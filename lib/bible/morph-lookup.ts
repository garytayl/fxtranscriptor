import type { PassageReference } from "@/lib/bible/reference"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"
import john1 from "@/lib/bible/morph-data/john-1.json"
import john2 from "@/lib/bible/morph-data/john-2.json"
import john3 from "@/lib/bible/morph-data/john-3.json"
import john4 from "@/lib/bible/morph-data/john-4.json"
import john5 from "@/lib/bible/morph-data/john-5.json"
import john6 from "@/lib/bible/morph-data/john-6.json"
import john7 from "@/lib/bible/morph-data/john-7.json"
import john8 from "@/lib/bible/morph-data/john-8.json"
import john9 from "@/lib/bible/morph-data/john-9.json"
import john10 from "@/lib/bible/morph-data/john-10.json"
import john11 from "@/lib/bible/morph-data/john-11.json"
import john12 from "@/lib/bible/morph-data/john-12.json"
import john13 from "@/lib/bible/morph-data/john-13.json"
import john14 from "@/lib/bible/morph-data/john-14.json"
import john15 from "@/lib/bible/morph-data/john-15.json"
import john16 from "@/lib/bible/morph-data/john-16.json"
import john17 from "@/lib/bible/morph-data/john-17.json"
import john18 from "@/lib/bible/morph-data/john-18.json"
import john19 from "@/lib/bible/morph-data/john-19.json"
import john20 from "@/lib/bible/morph-data/john-20.json"
import john21 from "@/lib/bible/morph-data/john-21.json"
import luke6 from "@/lib/bible/morph-data/luke-6.json"

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

const MORPH_PILOT_CHAPTERS = [
  john1,
  john2,
  john3,
  john4,
  john5,
  john6,
  john7,
  john8,
  john9,
  john10,
  john11,
  john12,
  john13,
  john14,
  john15,
  john16,
  john17,
  john18,
  john19,
  john20,
  john21,
  luke6,
] as MorphChapterFile[]

const MORPH_META = MORPH_PILOT_CHAPTERS[0].meta

/**
 * API.Bible book `id` is often USFM (e.g. LUK, JHN). Local HCSB uses the same ids as `lib/bible/constants`.
 */
const USFM_ID_TO_MORPH_SLUG: Record<string, string> = {
  LUK: "luke",
  JHN: "john",
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
