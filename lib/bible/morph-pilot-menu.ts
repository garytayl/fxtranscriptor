/**
 * MorphGNT pilot chapters exposed for “learn Greek” flows (client-safe).
 */

import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"
import ntCatalog from "@/lib/bible/morph-data/nt-catalog.json"

export type MorphPilotChapterMenuItem = {
  bookSlug: string
  /** Canonical book name for passage/morph API refs (e.g. "John", "Luke") */
  bookName: string
  chapter: number
  label: string
  /** Short line for the picker */
  tagline: string
  maxVerse: number
}

export const MORPH_PILOT_CHAPTERS: MorphPilotChapterMenuItem[] = ntCatalog as MorphPilotChapterMenuItem[]

/** Single-verse ref for `/api/bible/passage` and `/api/bible/morph` (e.g. `John 1:3`). */
export function morphPilotPassageRef(pilot: MorphPilotChapterMenuItem, verse: number): string {
  return `${pilot.bookName} ${pilot.chapter}:${verse}`
}

/** Opens the full scripture reader with Greek morphology + KJV line (`fx-greek`). */
export function morphPilotReaderUrl(bookSlug: string, chapter: number, verse: number): string {
  const params = new URLSearchParams()
  params.set("t", FX_GREEK_GRAMMAR_TRANSLATION_KEY)
  params.set("v", String(verse))
  return `/bible/${bookSlug}/${chapter}?${params.toString()}`
}
