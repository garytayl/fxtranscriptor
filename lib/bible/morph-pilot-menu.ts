/**
 * MorphGNT pilot chapters exposed for “learn Greek” flows (client-safe).
 */

import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"

export type MorphPilotChapterMenuItem = {
  bookSlug: string
  chapter: number
  label: string
  /** Short line for the picker */
  tagline: string
  maxVerse: number
}

export const MORPH_PILOT_CHAPTERS: MorphPilotChapterMenuItem[] = [
  {
    bookSlug: "john",
    chapter: 1,
    label: "John 1",
    tagline: "In the beginning was the Word…",
    maxVerse: 51,
  },
  {
    bookSlug: "luke",
    chapter: 6,
    label: "Luke 6",
    tagline: "Sabbath, beatitudes, love your enemies…",
    maxVerse: 49,
  },
]

/** Opens the full scripture reader with Greek morphology + KJV line (`fx-greek`). */
export function morphPilotReaderUrl(bookSlug: string, chapter: number, verse: number): string {
  const params = new URLSearchParams()
  params.set("t", FX_GREEK_GRAMMAR_TRANSLATION_KEY)
  params.set("v", String(verse))
  return `/bible/${bookSlug}/${chapter}?${params.toString()}`
}
