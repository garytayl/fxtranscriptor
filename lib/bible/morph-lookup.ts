import type { PassageReference } from "@/lib/bible/reference"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"
import john1 from "@/lib/bible/morph-data/john-1.json"
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

const MORPH_PILOT_CHAPTERS = [john1, luke6] as MorphChapterFile[]

const MORPH_META = MORPH_PILOT_CHAPTERS[0].meta

function getPilotChapter(bookSlug: string, chapter: number): MorphChapterFile | null {
  return (
    MORPH_PILOT_CHAPTERS.find((p) => p.bookSlug === bookSlug && p.chapter === chapter) ?? null
  )
}

export function getGreekMorphTokensForChapter(
  bookSlug: string,
  chapter: number
): Record<number, GreekMorphToken[]> | null {
  const pilot = getPilotChapter(bookSlug, chapter)
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
  wordIndex: number
): GreekMorphToken | null {
  const ch = getGreekMorphTokensForChapter(bookSlug, chapter)
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

function isMorphPilotChapter(bookSlug: string, chapterNumber: number): boolean {
  return getPilotChapter(bookSlug, chapterNumber) != null
}

/**
 * Returns morph tokens for a parsed passage when the pilot dataset covers that chapter.
 */
export function getMorphologyForPassage(parsed: PassageReference): MorphPassagePayload {
  const { bookSlug, chapterNumber, verseRange } = parsed
  const ch = getGreekMorphTokensForChapter(bookSlug, chapterNumber)
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
  const available = verses.length > 0 && isMorphPilotChapter(bookSlug, chapterNumber)

  return {
    available,
    cite: MORPH_META.cite,
    parsingLicense: MORPH_META.parsingLicense,
    textLicenseNote: MORPH_META.textLicenseNote,
    verses,
    readerGrammarUrl: available ? getReaderGrammarUrl(bookSlug, chapterNumber, firstVerse) : null,
  }
}
