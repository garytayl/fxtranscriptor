import type { PassageReference } from "@/lib/bible/reference"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import john1 from "@/lib/bible/morph-data/john-1.json"

type John1File = {
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

const JOHN_1 = john1 as John1File

export function getGreekMorphTokensForChapter(
  bookSlug: string,
  chapter: number
): Record<number, GreekMorphToken[]> | null {
  if (bookSlug === JOHN_1.bookSlug && chapter === JOHN_1.chapter) {
    const out: Record<number, GreekMorphToken[]> = {}
    for (const [v, tokens] of Object.entries(JOHN_1.verses)) {
      out[Number(v)] = tokens
    }
    return out
  }
  return null
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

/** Reader URL with KJV + verse anchor for Greek grammar pilot (John 1). */
export function getReaderGrammarUrl(bookSlug: string, chapter: number, verse: number): string {
  const params = new URLSearchParams()
  params.set("t", "kjv")
  params.set("v", String(verse))
  return `/bible/${bookSlug}/${chapter}?${params.toString()}`
}

/**
 * Returns morph tokens for a parsed passage when the pilot dataset covers it (John 1 only).
 */
export function getMorphologyForPassage(parsed: PassageReference): MorphPassagePayload {
  const { bookSlug, chapterNumber, verseRange } = parsed
  const ch = getGreekMorphTokensForChapter(bookSlug, chapterNumber)
  if (!ch || !verseRange) {
    return {
      available: false,
      cite: JOHN_1.meta.cite,
      parsingLicense: JOHN_1.meta.parsingLicense,
      textLicenseNote: JOHN_1.meta.textLicenseNote,
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
  const available = verses.length > 0 && bookSlug === "john" && chapterNumber === 1

  return {
    available,
    cite: JOHN_1.meta.cite,
    parsingLicense: JOHN_1.meta.parsingLicense,
    textLicenseNote: JOHN_1.meta.textLicenseNote,
    verses,
    readerGrammarUrl: available ? getReaderGrammarUrl(bookSlug, chapterNumber, firstVerse) : null,
  }
}
